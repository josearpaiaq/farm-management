import { IsIn } from 'class-validator';
import { MEMBER_ROLES, type MemberRole } from '../members.service';

export class UpdateMemberDto {
  @IsIn(MEMBER_ROLES)
  role: MemberRole;
}
