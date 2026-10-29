import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailCodesService } from './email-codes.service';
import { EmailService } from './email.service';
import { TokensService } from './tokens.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailCodesService, EmailService, TokensService],
})
export class AuthModule {}
