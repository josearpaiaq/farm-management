import {
  Body,
  Controller,
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
import { LoginDto } from './dto/login.dto';

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

    // Fresh session id on login prevents session fixation.
    await regenerateSession(req);
    req.session.userId = user.id;
    req.session.organizationId = user.organization_id;
    req.session.csrfToken = randomBytes(32).toString('hex');

    return this.authService.toAuthResponse(user, req.session.csrfToken);
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
}
