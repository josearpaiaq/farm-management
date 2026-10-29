import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name: string;

  // Name of the organization (the farm business) created for the new owner.
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  organization_name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  password: string;
}
