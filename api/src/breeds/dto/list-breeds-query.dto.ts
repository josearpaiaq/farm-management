import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SPECIES_CODES } from '../../common/constants/vocabularies';
import type { Species } from '../../common/constants/vocabularies';

export class ListBreedsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(SPECIES_CODES)
  species?: Species;
}
