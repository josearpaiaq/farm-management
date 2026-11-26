import { IsEmail, IsString, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class LoginDto {
  @Trim()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
