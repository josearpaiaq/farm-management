import { IsEmail } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class EmailDto {
  @Trim()
  @IsEmail()
  email: string;
}
