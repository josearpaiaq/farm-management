import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessTokenPayload {
  sub: string; // user id
  org: string; // organization id
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
// A rotated token presented again this soon is a concurrent refresh (e.g.
// two browser tabs), not theft: reject it without revoking the family.
const REUSE_GRACE_MS = 10_000;

// Short-lived JWT access tokens plus opaque, rotating refresh tokens.
// Refresh tokens expire after 30 days *without use*: each refresh replaces
// the token with a new one valid for another 30 days (sliding expiry).
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  // A new login: starts a new refresh token family.
  async issue(user: {
    id: string;
    organization_id: string;
  }): Promise<IssuedTokens> {
    return this.issueInFamily(user, randomUUID());
  }

  // Exchanges a refresh token for a new pair. Returns null when the token is
  // unknown, expired or already used; reuse of a rotated token outside the
  // grace window revokes the whole family.
  async rotate(refreshToken: string): Promise<{
    userId: string;
    tokens: IssuedTokens;
  } | null> {
    const record = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: hash(refreshToken) },
      include: { users: true },
    });
    if (!record) return null;

    const now = Date.now();
    if (record.revoked_at) {
      if (now - record.revoked_at.getTime() > REUSE_GRACE_MS) {
        await this.revokeFamily(record.family_id);
      }
      return null;
    }
    if (record.expires_at.getTime() <= now) return null;

    // Conditional update so two concurrent refreshes cannot both rotate it.
    const { count } = await this.prisma.refresh_tokens.updateMany({
      where: { id: record.id, revoked_at: null },
      data: { revoked_at: new Date(now) },
    });
    if (count !== 1) return null;

    return {
      userId: record.user_id,
      tokens: await this.issueInFamily(record.users, record.family_id),
    };
  }

  // Logout: ends the login (family) the refresh token belongs to.
  async revoke(refreshToken: string): Promise<void> {
    const record = await this.prisma.refresh_tokens.findUnique({
      where: { token_hash: hash(refreshToken) },
    });
    if (record) await this.revokeFamily(record.family_id);
  }

  // Signs the user out on every device (e.g. after a password reset).
  // Access tokens already issued stay valid until they expire (<= 15 min).
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refresh_tokens.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  private async issueInFamily(
    user: { id: string; organization_id: string },
    familyId: string,
  ): Promise<IssuedTokens> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        family_id: familyId,
        token_hash: hash(refreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    const payload: AccessTokenPayload = {
      sub: user.id,
      org: user.organization_id,
    };
    return { accessToken: await this.jwt.signAsync(payload), refreshToken };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refresh_tokens.updateMany({
      where: { family_id: familyId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}

// Refresh tokens are 256-bit random values, so a fast unsalted hash is
// enough: it only has to keep a database leak from yielding usable tokens.
function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
