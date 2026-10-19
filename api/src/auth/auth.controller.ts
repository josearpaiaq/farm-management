import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { EmailDto } from './dto/email.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

type AuthUser = NonNullable<Awaited<ReturnType<AuthService['findById']>>>;

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(toError(err)) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(toError(err)) : resolve()));
  });
}

// Public auth endpoints are rate limited per IP; emailed codes additionally
// lock after a few wrong attempts (see EmailCodesService).
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.email_verified_at) {
      // Correct password but unconfirmed email: send a fresh code so the
      // client can move straight to the verification step.
      await this.authService.sendCode(user, 'verify_email');
      throw new ForbiddenException('Email not verified');
    }
    return this.startSession(req, user);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.NO_CONTENT)
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    await this.authService.sendCode(user, 'verify_email');
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyCodeDto, @Req() req: Request) {
    const user = await this.authService.consumeCode(
      dto.email,
      'verify_email',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.markEmailVerified(user);
    return this.startSession(req, user);
  }

  // Always 204, whether or not the email exists (no user enumeration).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@Body() dto: EmailDto) {
    const user = await this.authService.findByEmail(dto.email);
    if (user && !user.email_verified_at) {
      await this.authService.sendCode(user, 'verify_email');
    }
  }

  // Passwordless login, step 1. Always 204 (no user enumeration).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestLoginCode(@Body() dto: EmailDto) {
    const user = await this.authService.findByEmail(dto.email);
    if (user) await this.authService.sendCode(user, 'login');
  }

  // Passwordless login, step 2. Also verifies the email if it was pending.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyLoginCode(@Body() dto: VerifyCodeDto, @Req() req: Request) {
    const user = await this.authService.consumeCode(
      dto.email,
      'login',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.markEmailVerified(user);
    return this.startSession(req, user);
  }

  // Password recovery, step 1. Always 204 (no user enumeration).
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/forgot')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: EmailDto) {
    const user = await this.authService.findByEmail(dto.email);
    if (user) await this.authService.sendCode(user, 'reset_password');
  }

  // Password recovery, step 2: new password, other sessions revoked, and
  // the user is signed in here.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const user = await this.authService.consumeCode(
      dto.email,
      'reset_password',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.resetPassword(user, dto.password);
    await this.authService.markEmailVerified(user);
    return this.startSession(req, user);
  }

  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.authService.findById(req.session.userId!);
    if (!user) {
      // The account disappeared under a live session; kill the session.
      await destroySession(req);
      throw new UnauthorizedException();
    }
    return this.authService.toAuthResponse(user, req.session.csrfToken!);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await destroySession(req);
    res.clearCookie('sid');
  }

  private async startSession(req: Request, user: AuthUser) {
    // Fresh session id on login prevents session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.organizationId = user.organization_id;
    req.session.csrfToken = randomBytes(32).toString('hex');

    return this.authService.toAuthResponse(user, req.session.csrfToken);
  }
}
