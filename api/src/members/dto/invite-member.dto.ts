import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MEMBER_ROLES, type MemberRole } from '../members.service';
import { Trim } from '../../common/decorators/trim.decorator';

export class InviteMemberDto {
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

  @Trim()
  @IsEmail()
  email: string;

  // Defaults to viewer (read only).
  @IsOptional()
  @IsIn(MEMBER_ROLES)
  role?: MemberRole;
}
