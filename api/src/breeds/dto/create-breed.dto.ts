import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SPECIES_CODES } from '../../common/constants/vocabularies';
import type { Species } from '../../common/constants/vocabularies';

export class CreateBreedDto {
  // Optional client-generated UUID (v7 preferred); see plan, API Conventions.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(SPECIES_CODES)
  species: Species;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
