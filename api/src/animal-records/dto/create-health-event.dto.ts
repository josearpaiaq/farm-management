import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { HEALTH_EVENT_CODES } from '../../common/constants/vocabularies';
import type { HealthEventType } from '../../common/constants/vocabularies';

export class CreateHealthEventDto {
  // Optional client-generated UUID (v7 preferred); see plan, API Conventions.
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn(HEALTH_EVENT_CODES)
  event_type: HealthEventType;

  @IsDateString()
  occurred_on: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  product?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // Date before which the animal (or its milk) must not be sold.
  @IsOptional()
  @IsDateString()
  withdrawal_until?: string;
}
