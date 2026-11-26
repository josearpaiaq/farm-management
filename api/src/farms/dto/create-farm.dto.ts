import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class CreateFarmDto {
  // Optional client-generated UUID (v7 preferred) so offline/retried creates
  // keep a stable identity (see plan, API Conventions).
  @IsOptional()
  @IsUUID()
  id?: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;
}
