import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';

// Every query is scoped to the caller's organization_id (anti-IDOR; see
// plan, Security). The id alone is never enough to reach a row.
@Injectable()
export class FarmsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, { limit, offset }: PaginationQueryDto) {
    const where = { organization_id: organizationId, deleted_at: null };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.farms.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.farms.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  async create(organizationId: string, dto: CreateFarmDto) {
    try {
      return await this.prisma.farms.create({
        data: {
          id: dto.id,
          organization_id: organizationId,
          name: dto.name,
          location: dto.location,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A farm with this id already exists');
      }
      throw error;
    }
  }

  async findOne(organizationId: string, id: string) {
    const farm = await this.prisma.farms.findFirst({
      where: { id, organization_id: organizationId, deleted_at: null },
    });
    if (!farm) throw new NotFoundException('Farm not found');
    return farm;
  }

  async update(organizationId: string, id: string, dto: UpdateFarmDto) {
    await this.findOne(organizationId, id);
    return this.prisma.farms.update({
      where: { id },
      data: { name: dto.name, location: dto.location },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);

    // Farms with animals cannot be deleted (plan, Features): the herd must
    // be moved or the animals' lifecycle closed first.
    const animals = await this.prisma.animals.count({
      where: { farm_id: id, deleted_at: null },
    });
    if (animals > 0) {
      throw new ConflictException('Farm still has animals');
    }

    await this.prisma.farms.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  }
}
