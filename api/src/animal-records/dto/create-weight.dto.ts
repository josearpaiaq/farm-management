import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
} from 'class-validator';

export class CreateWeightDto {
  // Optional client-generated UUID (v7 preferred); see plan, API Conventions.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(99999.99)
  weight_kg: number;

  @IsDateString()
  recorded_on: string;
}
