import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  ANIMAL_STATUS_CODES,
  SEX_CODES,
  SPECIES_CODES,
} from '../../common/constants/vocabularies';
import type {
  AnimalStatus,
  Sex,
  Species,
} from '../../common/constants/vocabularies';

export class ListAnimalsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  farm_id?: string;

  @IsOptional()
  @IsIn(SPECIES_CODES)
  species?: Species;

  @IsOptional()
  @IsIn(ANIMAL_STATUS_CODES)
  status?: AnimalStatus;

  @IsOptional()
  @IsIn(SEX_CODES)
  sex?: Sex;
}
