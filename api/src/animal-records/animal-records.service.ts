import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { FieldError } from '../common/filters/http-exception.filter';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHealthEventDto } from './dto/create-health-event.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateWeightDto } from './dto/create-weight.dto';

// Weights, health events, and notes are append-only history rows: they are
// created and listed, never updated. Soft delete exists only for records
// created in error (see plan, Architecture).
@Injectable()
export class AnimalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- weights ---------------------------------------------------------

  async listWeights(
    organizationId: string,
    animalId: string,
    { limit, offset }: PaginationQueryDto,
  ) {
    await this.assertAnimalInOrg(organizationId, animalId);
    const where = { animal_id: animalId, deleted_at: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.weight_records.findMany({
        where,
        orderBy: [{ recorded_on: 'desc' }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.weight_records.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async addWeight(
    organizationId: string,
    animalId: string,
    dto: CreateWeightDto,
  ) {
    await this.assertAnimalInOrg(organizationId, animalId);
    this.assertValid([this.notFuture('recorded_on', dto.recorded_on)]);
    try {
      return await this.prisma.weight_records.create({
        data: {
          id: dto.id,
          animal_id: animalId,
          weight_kg: dto.weight_kg,
          recorded_on: new Date(dto.recorded_on),
        },
      });
    } catch (error) {
      throw this.mapDuplicateId(error, 'weight record');
    }
  }

  async removeWeight(
    organizationId: string,
    animalId: string,
    id: string,
  ): Promise<void> {
    await this.assertAnimalInOrg(organizationId, animalId);
    await this.softDelete(this.prisma.weight_records, id, animalId);
  }

  // --- health events ---------------------------------------------------

  async listHealthEvents(
    organizationId: string,
    animalId: string,
    { limit, offset }: PaginationQueryDto,
  ) {
    await this.assertAnimalInOrg(organizationId, animalId);
    const where = { animal_id: animalId, deleted_at: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.health_events.findMany({
        where,
        orderBy: [{ occurred_on: 'desc' }, { created_at: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.health_events.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async addHealthEvent(
    organizationId: string,
    animalId: string,
    dto: CreateHealthEventDto,
  ) {
    await this.assertAnimalInOrg(organizationId, animalId);
    this.assertValid([
      this.notFuture('occurred_on', dto.occurred_on),
      dto.withdrawal_until &&
      new Date(dto.withdrawal_until) < new Date(dto.occurred_on)
        ? {
            field: 'withdrawal_until',
            message: 'Withdrawal date cannot be before the event date',
          }
        : null,
    ]);
    try {
      return await this.prisma.health_events.create({
        data: {
          id: dto.id,
          animal_id: animalId,
          event_type: dto.event_type,
          occurred_on: new Date(dto.occurred_on),
          product: dto.product,
          description: dto.description,
          withdrawal_until: dto.withdrawal_until
            ? new Date(dto.withdrawal_until)
            : null,
        },
      });
    } catch (error) {
      throw this.mapDuplicateId(error, 'health event');
    }
  }

  async removeHealthEvent(
    organizationId: string,
    animalId: string,
    id: string,
  ): Promise<void> {
    await this.assertAnimalInOrg(organizationId, animalId);
    await this.softDelete(this.prisma.health_events, id, animalId);
  }

  // --- notes -----------------------------------------------------------

  async listNotes(
    organizationId: string,
    animalId: string,
    { limit, offset }: PaginationQueryDto,
  ) {
    await this.assertAnimalInOrg(organizationId, animalId);
    const where = { animal_id: animalId, deleted_at: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.notes.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notes.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async addNote(organizationId: string, animalId: string, dto: CreateNoteDto) {
    await this.assertAnimalInOrg(organizationId, animalId);
    try {
      return await this.prisma.notes.create({
        data: { id: dto.id, animal_id: animalId, body: dto.body },
      });
    } catch (error) {
      throw this.mapDuplicateId(error, 'note');
    }
  }

  async removeNote(
    organizationId: string,
    animalId: string,
    id: string,
  ): Promise<void> {
    await this.assertAnimalInOrg(organizationId, animalId);
    await this.softDelete(this.prisma.notes, id, animalId);
  }

  // --- shared ----------------------------------------------------------

  private async assertAnimalInOrg(
    organizationId: string,
    animalId: string,
  ): Promise<void> {
    const animal = await this.prisma.animals.findFirst({
      where: {
        id: animalId,
        organization_id: organizationId,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!animal) throw new NotFoundException('Animal not found');
  }

  private async softDelete(
    delegate: {
      updateMany: (args: {
        where: { id: string; animal_id: string; deleted_at: null };
        data: { deleted_at: Date };
      }) => Prisma.PrismaPromise<{ count: number }>;
    },
    id: string,
    animalId: string,
  ): Promise<void> {
    const result = await delegate.updateMany({
      where: { id, animal_id: animalId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Record not found');
  }

  private notFuture(field: string, value: string): FieldError | null {
    return new Date(value) > new Date()
      ? { field, message: 'Date cannot be in the future' }
      : null;
  }

  private assertValid(checks: (FieldError | null)[]): void {
    const details = checks.filter((check): check is FieldError => !!check);
    if (details.length > 0) {
      throw new UnprocessableEntityException({
        message: 'Validation failed',
        details,
      });
    }
  }

  private mapDuplicateId(error: unknown, resource: string): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(`A ${resource} with this id already exists`);
    }
    return error;
  }
}
