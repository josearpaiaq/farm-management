import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MEMBER_ROLES, type MemberRole } from '../members.service';

export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name: string;

  @IsEmail()
  email: string;

  // Defaults to viewer (read only).
  @IsOptional()
  @IsIn(MEMBER_ROLES)
  role?: MemberRole;
}
