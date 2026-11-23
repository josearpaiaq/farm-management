import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  ANIMAL_STATUS_CODES,
  SEX_CODES,
  SPECIES_CODES,
  TENURE_CODES,
} from '../../common/constants/vocabularies';
import type {
  AnimalStatus,
  Sex,
  Species,
  Tenure,
} from '../../common/constants/vocabularies';

export class CreateAnimalDto {
  // Optional client-generated UUID (v7 preferred); see plan, API Conventions.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsUUID()
  farm_id: string;

  @IsIn(SPECIES_CODES)
  species: Species;

  @IsIn(SEX_CODES)
  sex: Sex;

  // Primary visual tag; the natural key within the organization. The animal
  // and its identifier row are created atomically.
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tag: string;

  @IsOptional()
  @IsUUID()
  breed_id?: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsOptional()
  @IsIn(TENURE_CODES)
  tenure?: Tenure;

  @IsOptional()
  @IsIn(ANIMAL_STATUS_CODES)
  status?: AnimalStatus;

  // Genealogy, captured from day one (cannot be reconstructed later).
  @IsOptional()
  @IsUUID()
  sire_id?: string;

  @IsOptional()
  @IsUUID()
  dam_id?: string;
}
