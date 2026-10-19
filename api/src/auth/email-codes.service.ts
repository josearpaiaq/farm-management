import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type EmailCodePurpose = 'verify_email' | 'login' | 'reset_password';

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

// Six-digit one-time codes delivered by email. Only an HMAC (keyed with the
// session secret) is stored, a new code supersedes older ones for the same
// purpose, and a code locks after MAX_ATTEMPTS wrong guesses.
@Injectable()
export class EmailCodesService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('SESSION_SECRET');
  }

  async issue(userId: string, purpose: EmailCodePurpose): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      this.prisma.email_codes.deleteMany({
        where: { user_id: userId, purpose },
      }),
      this.prisma.email_codes.create({
        data: {
          user_id: userId,
          purpose,
          code_hash: this.hash(code),
          expires_at: new Date(Date.now() + CODE_TTL_MS),
        },
      }),
    ]);
    return code;
  }

  // Returns true and consumes the code when it matches a live code.
  async consume(
    userId: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<boolean> {
    const record = await this.prisma.email_codes.findFirst({
      where: {
        user_id: userId,
        purpose,
        consumed_at: null,
        expires_at: { gt: new Date() },
        attempts: { lt: MAX_ATTEMPTS },
      },
    });
    if (!record) return false;

    const expected = Buffer.from(record.code_hash, 'hex');
    const actual = Buffer.from(this.hash(code), 'hex');
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.email_codes.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }

    // Conditional update so two concurrent requests cannot both consume it.
    const { count } = await this.prisma.email_codes.updateMany({
      where: { id: record.id, consumed_at: null },
      data: { consumed_at: new Date() },
    });
    return count === 1;
  }

  private hash(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }
}
