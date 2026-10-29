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
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { EmailDto } from './dto/email.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  IssuedTokens,
  REFRESH_TOKEN_TTL_MS,
  TokensService,
} from './tokens.service';

type AuthUser = NonNullable<Awaited<ReturnType<AuthService['findById']>>>;

// Web clients keep the refresh token in an httpOnly cookie that JavaScript
// cannot read. Native clients (mobile/desktop) have no cookie jar worth
// trusting, so they opt into receiving and sending it in the JSON body.
const REFRESH_COOKIE = 'refresh_token';
const BODY_TRANSPORT_HEADER = 'x-auth-transport';

function usesBodyTransport(req: Request): boolean {
  return req.get(BODY_TRANSPORT_HEADER) === 'body';
}

function refreshCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    // Strict: never sent on cross-site requests, which rules out CSRF on the
    // only two endpoints that read it (refresh, logout). app.x.com and
    // api.x.com are the same site, so this still works across subdomains.
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
  };
}

// Public auth endpoints are rate limited per IP; emailed codes additionally
// lock after a few wrong attempts (see EmailCodesService).
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly tokens: TokensService,
    config: ConfigService,
  ) {
    this.secureCookies = config.get<string>('NODE_ENV') === 'production';
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.email_verified_at) {
      // Correct password but unconfirmed email: send a fresh code so the
      // client can move straight to the verification step.
      await this.authService.sendCode(user, 'verify_email');
      throw new ForbiddenException('Email not verified');
    }
    return this.signIn(req, res, user);
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
  async verifyEmail(
    @Body() dto: VerifyCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.consumeCode(
      dto.email,
      'verify_email',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.markEmailVerified(user);
    return this.signIn(req, res, user);
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
  async verifyLoginCode(
    @Body() dto: VerifyCodeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.consumeCode(
      dto.email,
      'login',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.markEmailVerified(user);
    return this.signIn(req, res, user);
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

  // Password recovery, step 2: new password, every other login revoked, and
  // the user is signed in here.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.consumeCode(
      dto.email,
      'reset_password',
      dto.code,
    );
    if (!user) throw new UnauthorizedException('Invalid or expired code');
    await this.authService.resetPassword(user, dto.password);
    await this.authService.markEmailVerified(user);
    return this.signIn(req, res, user);
  }

  // Exchanges a refresh token (cookie for web, body for native clients) for
  // a new access token and a rotated refresh token.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = this.presentedRefreshToken(dto, req);
    const rotated = presented ? await this.tokens.rotate(presented) : null;
    const user = rotated && (await this.authService.findById(rotated.userId));
    if (!rotated || !user) {
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.secureCookies));
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.respondWithTokens(req, res, user, rotated.tokens);
  }

  @Get('me')
  async me(@CurrentUserId() userId: string) {
    const user = await this.authService.findById(userId);
    // The account was deleted while its access token was still valid.
    if (!user) throw new UnauthorizedException();
    return { user: this.authService.toUserResponse(user) };
  }

  // Public: logging out only needs the refresh token, so it also works
  // after the access token expired. Always 204.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented = this.presentedRefreshToken(dto, req);
    if (presented) await this.tokens.revoke(presented);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.secureCookies));
  }

  private presentedRefreshToken(dto: RefreshDto, req: Request) {
    const cookies = req.cookies as Record<string, string | undefined>;
    return dto.refresh_token ?? cookies[REFRESH_COOKIE];
  }

  private async signIn(req: Request, res: Response, user: AuthUser) {
    return this.respondWithTokens(
      req,
      res,
      user,
      await this.tokens.issue(user),
    );
  }

  private respondWithTokens(
    req: Request,
    res: Response,
    user: AuthUser,
    tokens: IssuedTokens,
  ) {
    const body = {
      user: this.authService.toUserResponse(user),
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
    if (usesBodyTransport(req)) {
      return { ...body, refresh_token: tokens.refreshToken };
    }
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...refreshCookieOptions(this.secureCookies),
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
    return body;
  }
}
