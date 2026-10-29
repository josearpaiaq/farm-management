import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBreedDto } from './dto/create-breed.dto';
import { ListBreedsQueryDto } from './dto/list-breeds-query.dto';

@Injectable()
export class BreedsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListBreedsQueryDto) {
    const where = {
      organization_id: organizationId,
      deleted_at: null,
      ...(query.species && { species: query.species }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.breeds.findMany({
        where,
        orderBy: [{ species: 'asc' }, { name: 'asc' }],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.breeds.count({ where }),
    ]);
    return { data, total, limit: query.limit, offset: query.offset };
  }

  async create(organizationId: string, dto: CreateBreedDto) {
    try {
      return await this.prisma.breeds.create({
        data: {
          id: dto.id,
          organization_id: organizationId,
          species: dto.species,
          name: dto.name,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A breed with this name already exists for this species',
        );
      }
      throw error;
    }
  }
}
