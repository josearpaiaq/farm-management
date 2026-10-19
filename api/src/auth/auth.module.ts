import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailCodesService } from './email-codes.service';
import { EmailService } from './email.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailCodesService, EmailService],
})
export class AuthModule {}
