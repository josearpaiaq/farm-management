import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class CreateNoteDto {
  // Optional client-generated UUID (v7 preferred); see plan, API Conventions.
  @IsOptional()
  @IsUUID()
  id?: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
