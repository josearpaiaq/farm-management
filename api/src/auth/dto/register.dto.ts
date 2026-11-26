import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class RegisterDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name: string;

  // Both surnames when there are two.
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name: string;

  // Name of the organization (the farm business) created for the new owner.
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organization_name: string;

  @Trim()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
