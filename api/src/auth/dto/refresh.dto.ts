import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Native clients send the refresh token here; web clients send it in the
  // httpOnly cookie and leave this empty.
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
