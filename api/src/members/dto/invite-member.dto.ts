import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  full_name: string;

  @IsEmail()
  email: string;
}
