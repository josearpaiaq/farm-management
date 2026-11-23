import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  decodeBuffer,
  detectDelimiter,
  parseDate,
  parseDecimal,
  SEX_SYNONYMS,
  SPECIES_SYNONYMS,
  TENURE_SYNONYMS,
} from './csv.util';

export const CSV_TEMPLATE =
  '﻿' +
  'tag;species;sex;farm;breed;birth_date;tenure;weight_kg;weight_date\n' +
  'V-001;cattle;female;La Esperanza;Brahman;15/03/2022;owned;350,5;01/06/2026\n';

const REQUIRED_COLUMNS = ['tag', 'species', 'sex', 'farm'] as const;

interface CsvRow extends Record<string, string | undefined> {
  tag?: string;
  species?: string;
  sex?: string;
  farm?: string;
  breed?: string;
  birth_date?: string;
  tenure?: string;
  weight_kg?: string;
  weight_date?: string;
}

interface ParsedRow {
  rowNumber: number;
  errors: string[];
  tag: string;
  species: string;
  sex: string;
  farmId?: string;
  breedId?: string;
  birthDate?: Date;
  tenure?: string;
  weightKg?: number;
  weightDate?: Date;
}

export interface RowResult {
  row_number: number;
  status: 'valid' | 'invalid' | 'imported' | 'skipped' | 'error';
  message: string | null;
  animal_id: string | null;
}

const jobSelect = {
  id: true,
  filename: true,
  dry_run: true,
  status: true,
  total_rows: true,
  ok_rows: true,
  error_rows: true,
  created_by: true,
  created_at: true,
  updated_at: true,
};

// Two-phase CSV import of an existing herd (see plan, CSV Import):
// a dry run validates every row and writes nothing; a commit imports the
// valid rows one transaction per row, skipping tags that already exist so
// re-uploading the same file never duplicates. The raw file and a per-row
// result are persisted for auditability.
@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  async importAnimals(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    dryRun: boolean,
  ) {
    const job = await this.prisma.import_jobs.create({
      data: {
        organization_id: organizationId,
        created_by: userId,
        filename: file.originalname,
        raw_file: new Uint8Array(file.buffer),
        dry_run: dryRun,
      },
    });

    try {
      const rows = this.parseCsv(file.buffer);
      const { parsed, existingTags } = await this.validateRows(
        organizationId,
        rows,
      );
      const results = dryRun
        ? parsed.map((row): RowResult => ({
            row_number: row.rowNumber,
            status: row.errors.length > 0 ? 'invalid' : 'valid',
            message: row.errors.length > 0 ? row.errors.join('; ') : null,
            animal_id: null,
          }))
        : await this.commitRows(organizationId, job.id, parsed, existingTags);

      const errorCount = results.filter(
        (result) => result.status === 'invalid' || result.status === 'error',
      ).length;
      const okCount = results.filter(
        (result) => result.status === 'valid' || result.status === 'imported',
      ).length;

      await this.prisma.import_row_results.createMany({
        data: results.map((result) => ({ ...result, import_job_id: job.id })),
      });
      const updated = await this.prisma.import_jobs.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          total_rows: results.length,
          ok_rows: okCount,
          error_rows: errorCount,
        },
        select: jobSelect,
      });

      return {
        job: updated,
        summary: {
          total: results.length,
          [dryRun ? 'valid' : 'imported']: okCount,
          skipped: results.filter((result) => result.status === 'skipped')
            .length,
          errors: errorCount,
        },
        results,
      };
    } catch (error) {
      await this.prisma.import_jobs.update({
        where: { id: job.id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async listJobs(
    organizationId: string,
    { limit, offset }: PaginationQueryDto,
  ) {
    const where = { organization_id: organizationId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.import_jobs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
        select: jobSelect,
      }),
      this.prisma.import_jobs.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async findJob(organizationId: string, id: string) {
    const job = await this.prisma.import_jobs.findFirst({
      where: { id, organization_id: organizationId },
      select: {
        ...jobSelect,
        import_row_results: {
          orderBy: { row_number: 'asc' },
          select: {
            row_number: true,
            status: true,
            message: true,
            animal_id: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Import job not found');
    const { import_row_results, ...rest } = job;
    return { ...rest, results: import_row_results };
  }

  // Downloadable per-row report (see plan): one line per CSV row.
  async buildReport(organizationId: string, id: string): Promise<string> {
    const job = await this.findJob(organizationId, id);
    const lines = job.results.map(
      (row) =>
        `${row.row_number};${row.status};"${(row.message ?? '').replaceAll('"', '""')}"`,
    );
    return '﻿' + ['row_number;status;message', ...lines].join('\n') + '\n';
  }

  private parseCsv(buffer: Buffer): CsvRow[] {
    const text = decodeBuffer(buffer);
    let rows: CsvRow[];
    try {
      rows = parse(text, {
        columns: (header: string[]) =>
          header.map((column) => column.trim().toLowerCase()),
        delimiter: detectDelimiter(text),
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });
    } catch {
      throw this.fileError('The file could not be parsed as CSV');
    }

    if (rows.length === 0) {
      throw this.fileError('The file has no data rows');
    }
    const missing = REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
    if (missing.length > 0) {
      throw this.fileError(`Missing required columns: ${missing.join(', ')}`);
    }
    return rows;
  }

  private async validateRows(
    organizationId: string,
    rows: CsvRow[],
  ): Promise<{ parsed: ParsedRow[]; existingTags: Set<string> }> {
    const [farms, breeds, identifiers] = await this.prisma.$transaction([
      this.prisma.farms.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true },
      }),
      this.prisma.breeds.findMany({
        where: { organization_id: organizationId, deleted_at: null },
        select: { id: true, name: true, species: true },
      }),
      this.prisma.animal_identifiers.findMany({
        where: {
          organization_id: organizationId,
          id_type: 'tag',
          deleted_at: null,
        },
        select: { value: true },
      }),
    ]);
    const farmsByName = new Map(
      farms.map((farm) => [farm.name.toLowerCase(), farm.id]),
    );
    const breedsByName = new Map(
      breeds.map((breed) => [
        breed.name.toLowerCase(),
        { id: breed.id, species: breed.species },
      ]),
    );
    const existingTags = new Set(identifiers.map((row) => row.value));

    const seenInFile = new Map<string, number>();

    // Row 1 is the header line; data starts at row 2.
    const parsed = rows.map((row, index): ParsedRow => {
      const rowNumber = index + 2;
      const errors: string[] = [];

      const tag = (row.tag ?? '').trim();
      if (!tag) errors.push('Tag is required');
      else if (seenInFile.has(tag)) {
        errors.push(
          `Duplicate tag in file (first seen in row ${seenInFile.get(tag)})`,
        );
      } else {
        seenInFile.set(tag, rowNumber);
      }

      const species =
        SPECIES_SYNONYMS[(row.species ?? '').trim().toLowerCase()];
      if (!species) errors.push(`Unknown species "${row.species ?? ''}"`);

      const sex = SEX_SYNONYMS[(row.sex ?? '').trim().toLowerCase()];
      if (!sex) errors.push(`Unknown sex "${row.sex ?? ''}"`);

      const farmName = (row.farm ?? '').trim();
      const farmId = farmsByName.get(farmName.toLowerCase());
      if (!farmId) errors.push(`Unknown farm "${farmName}"`);

      let breedId: string | undefined;
      const breedName = (row.breed ?? '').trim();
      if (breedName) {
        const breed = breedsByName.get(breedName.toLowerCase());
        if (!breed) errors.push(`Unknown breed "${breedName}"`);
        else if (species && breed.species !== species) {
          errors.push(`Breed "${breedName}" is not a ${species} breed`);
        } else breedId = breed?.id;
      }

      let birthDate: Date | undefined;
      const rawBirth = (row.birth_date ?? '').trim();
      if (rawBirth) {
        const date = parseDate(rawBirth);
        if (!date) errors.push(`Unparseable birth date "${rawBirth}"`);
        else if (date > new Date()) errors.push('Birth date is in the future');
        else birthDate = date;
      }

      let tenure: string | undefined;
      const rawTenure = (row.tenure ?? '').trim();
      if (rawTenure) {
        tenure = TENURE_SYNONYMS[rawTenure.toLowerCase()];
        if (!tenure) errors.push(`Unknown tenure "${rawTenure}"`);
      }

      let weightKg: number | undefined;
      const rawWeight = (row.weight_kg ?? '').trim();
      if (rawWeight) {
        const weight = parseDecimal(rawWeight);
        if (weight === null) errors.push(`Unparseable weight "${rawWeight}"`);
        else if (weight <= 0) errors.push('Weight must be positive');
        else weightKg = weight;
      }

      let weightDate: Date | undefined;
      const rawWeightDate = (row.weight_date ?? '').trim();
      if (rawWeightDate) {
        const date = parseDate(rawWeightDate);
        if (!date) errors.push(`Unparseable weight date "${rawWeightDate}"`);
        else weightDate = date;
      }

      return {
        rowNumber,
        errors,
        tag,
        species: species ?? '',
        sex: sex ?? '',
        farmId,
        breedId,
        birthDate,
        tenure,
        weightKg,
        weightDate,
      };
    });

    return { parsed, existingTags };
  }

  // One transaction per row: a failing row never blocks the others, and an
  // animal is never created without its identifier (see plan, CSV Import).
  private async commitRows(
    organizationId: string,
    jobId: string,
    rows: ParsedRow[],
    existingTags: Set<string>,
  ): Promise<RowResult[]> {
    const results: RowResult[] = [];
    for (const row of rows) {
      if (row.errors.length > 0) {
        results.push({
          row_number: row.rowNumber,
          status: 'invalid',
          message: row.errors.join('; '),
          animal_id: null,
        });
        continue;
      }
      if (existingTags.has(row.tag)) {
        results.push({
          row_number: row.rowNumber,
          status: 'skipped',
          message: 'An animal with this tag already exists',
          animal_id: null,
        });
        continue;
      }
      try {
        const animalId = await this.prisma.$transaction(async (tx) => {
          const animal = await tx.animals.create({
            data: {
              organization_id: organizationId,
              farm_id: row.farmId!,
              species: row.species,
              sex: row.sex,
              breed_id: row.breedId,
              birth_date: row.birthDate,
              tenure: row.tenure,
              import_job_id: jobId,
            },
          });
          await tx.animal_identifiers.create({
            data: {
              organization_id: organizationId,
              animal_id: animal.id,
              id_type: 'tag',
              value: row.tag,
              is_primary: true,
            },
          });
          if (row.weightKg !== undefined) {
            await tx.weight_records.create({
              data: {
                animal_id: animal.id,
                weight_kg: row.weightKg,
                recorded_on: row.weightDate ?? new Date(),
              },
            });
          }
          return animal.id;
        });
        existingTags.add(row.tag);
        results.push({
          row_number: row.rowNumber,
          status: 'imported',
          message: null,
          animal_id: animalId,
        });
      } catch (error) {
        results.push({
          row_number: row.rowNumber,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unexpected error',
          animal_id: null,
        });
      }
    }
    return results;
  }

  private fileError(message: string): UnprocessableEntityException {
    return new UnprocessableEntityException({
      message: 'Validation failed',
      details: [{ field: 'file', message }],
    });
  }
}
