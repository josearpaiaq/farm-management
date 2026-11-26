import { IsEmail, Matches } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class VerifyCodeDto {
  @Trim()
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
