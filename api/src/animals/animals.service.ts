import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { FieldError } from '../common/filters/http-exception.filter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnimalDto } from './dto/create-animal.dto';
import { ListAnimalsQueryDto } from './dto/list-animals-query.dto';
import { UpdateAnimalDto } from './dto/update-animal.dto';

const detailInclude = {
  animal_identifiers: {
    where: { deleted_at: null },
    select: { id: true, id_type: true, value: true, is_primary: true },
  },
  breeds: { select: { id: true, name: true } },
  farms: { select: { id: true, name: true } },
} satisfies Prisma.animalsInclude;

@Injectable()
export class AnimalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListAnimalsQueryDto) {
    const where = {
      organization_id: organizationId,
      deleted_at: null,
      ...(query.farm_id && { farm_id: query.farm_id }),
      ...(query.species && { species: query.species }),
      ...(query.status && { status: query.status }),
      ...(query.sex && { sex: query.sex }),
    };
    const [animals, total] = await this.prisma.$transaction([
      this.prisma.animals.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: query.offset,
        include: {
          animal_identifiers: {
            where: { is_primary: true, deleted_at: null },
            select: { value: true },
          },
          breeds: { select: { id: true, name: true } },
          farms: { select: { id: true, name: true } },
        },
      }),
      this.prisma.animals.count({ where }),
    ]);

    const data = animals.map(
      ({ animal_identifiers, breeds, farms, ...animal }) => ({
        ...animal,
        tag: animal_identifiers[0]?.value ?? null,
        breed: breeds,
        farm: farms,
      }),
    );
    return { data, total, limit: query.limit, offset: query.offset };
  }

  async findOne(organizationId: string, id: string) {
    const animal = await this.prisma.animals.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
      include: detailInclude,
    });
    if (!animal) throw new NotFoundException('Animal not found');

    const { animal_identifiers, breeds, farms, ...rest } = animal;
    return {
      ...rest,
      tag: animal_identifiers.find((i) => i.is_primary)?.value ?? null,
      identifiers: animal_identifiers,
      breed: breeds,
      farm: farms,
    };
  }

  async create(organizationId: string, dto: CreateAnimalDto) {
    await this.validateReferences(organizationId, dto);

    try {
      const animal = await this.prisma.$transaction(async (tx) => {
        const created = await tx.animals.create({
          data: {
            id: dto.id,
            organization_id: organizationId,
            farm_id: dto.farm_id,
            species: dto.species,
            sex: dto.sex,
            breed_id: dto.breed_id,
            birth_date: dto.birth_date ? new Date(dto.birth_date) : null,
            tenure: dto.tenure,
            status: dto.status,
            sire_id: dto.sire_id,
            dam_id: dto.dam_id,
          },
        });
        await tx.animal_identifiers.create({
          data: {
            organization_id: organizationId,
            animal_id: created.id,
            id_type: 'tag',
            value: dto.tag,
            is_primary: true,
          },
        });
        return created;
      });
      return await this.findOne(organizationId, animal.id);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async update(organizationId: string, id: string, dto: UpdateAnimalDto) {
    const current = await this.prisma.animals.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
    });
    if (!current) throw new NotFoundException('Animal not found');

    await this.validateReferences(organizationId, dto, {
      id,
      species: current.species,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.animals.update({
          where: { id },
          data: {
            farm_id: dto.farm_id,
            species: dto.species,
            sex: dto.sex,
            breed_id: dto.breed_id,
            birth_date: dto.birth_date ? new Date(dto.birth_date) : undefined,
            tenure: dto.tenure,
            status: dto.status,
            sire_id: dto.sire_id,
            dam_id: dto.dam_id,
          },
        });

        if (dto.tag !== undefined) {
          const primary = await tx.animal_identifiers.findFirst({
            where: { animal_id: id, is_primary: true, deleted_at: null },
          });
          if (primary && primary.value !== dto.tag) {
            await tx.animal_identifiers.update({
              where: { id: primary.id },
              data: { value: dto.tag },
            });
          } else if (!primary) {
            await tx.animal_identifiers.create({
              data: {
                organization_id: organizationId,
                animal_id: id,
                id_type: 'tag',
                value: dto.tag,
                is_primary: true,
              },
            });
          }
        }
      });
      return await this.findOne(organizationId, id);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  // Soft delete, reserved for records created in error (the lifecycle is
  // driven by `status`, never by deleting). Frees the animal's identifiers
  // so the tag can be reused.
  async remove(organizationId: string, id: string): Promise<void> {
    const animal = await this.prisma.animals.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
    });
    if (!animal) throw new NotFoundException('Animal not found');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.animals.update({
        where: { id },
        data: { deleted_at: now },
      }),
      this.prisma.animal_identifiers.updateMany({
        where: { animal_id: id, deleted_at: null },
        data: { deleted_at: now },
      }),
    ]);
  }

  // Minimal herd stats (plan, Features): counts by status and species.
  async stats(organizationId: string) {
    const where = { organization_id: organizationId, deleted_at: null };
    const [byStatus, bySpecies, total] = await this.prisma.$transaction([
      this.prisma.animals.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: true,
      }),
      this.prisma.animals.groupBy({
        by: ['species'],
        where,
        orderBy: { species: 'asc' },
        _count: true,
      }),
      this.prisma.animals.count({ where }),
    ]);
    return {
      total,
      by_status: Object.fromEntries(
        byStatus.map((row) => [row.status, row._count]),
      ),
      by_species: Object.fromEntries(
        bySpecies.map((row) => [row.species, row._count]),
      ),
    };
  }

  // Cross-reference validation: every referenced row must belong to the
  // caller's organization, and species/sex must be coherent. Failures are
  // reported per field in the standard validation error shape.
  private async validateReferences(
    organizationId: string,
    dto: Partial<CreateAnimalDto>,
    current?: { id: string; species: string },
  ): Promise<void> {
    const details: FieldError[] = [];
    const species = dto.species ?? current?.species;

    if (dto.farm_id) {
      const farm = await this.prisma.farms.findFirst({
        where: {
          id: dto.farm_id,
          organization_id: organizationId,
          deleted_at: null,
        },
      });
      if (!farm) details.push({ field: 'farm_id', message: 'Farm not found' });
    }

    if (dto.breed_id) {
      const breed = await this.prisma.breeds.findFirst({
        where: {
          id: dto.breed_id,
          organization_id: organizationId,
          deleted_at: null,
        },
      });
      if (!breed) {
        details.push({ field: 'breed_id', message: 'Breed not found' });
      } else if (breed.species !== species) {
        details.push({
          field: 'breed_id',
          message: 'Breed species does not match the animal species',
        });
      }
    }

    for (const [field, expectedSex] of [
      ['sire_id', 'male'],
      ['dam_id', 'female'],
    ] as const) {
      const parentId = dto[field];
      if (!parentId) continue;
      if (current && parentId === current.id) {
        details.push({
          field,
          message: 'An animal cannot be its own parent',
        });
        continue;
      }
      const parent = await this.prisma.animals.findFirst({
        where: {
          id: parentId,
          organization_id: organizationId,
          deleted_at: null,
        },
      });
      if (!parent) {
        details.push({ field, message: 'Animal not found' });
      } else {
        if (parent.sex !== expectedSex) {
          details.push({ field, message: `Parent must be ${expectedSex}` });
        }
        if (species && parent.species !== species) {
          details.push({
            field,
            message: 'Parent species does not match the animal species',
          });
        }
      }
    }

    if (dto.birth_date && new Date(dto.birth_date) > new Date()) {
      details.push({
        field: 'birth_date',
        message: 'Birth date cannot be in the future',
      });
    }

    if (details.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        details,
      });
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : '';
      if (target.includes('value') || target.includes('identifier')) {
        return new ConflictException(
          'This tag is already in use by another animal',
        );
      }
      return new ConflictException('An animal with this id already exists');
    }
    return error;
  }
}
