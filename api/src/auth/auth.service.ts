import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type UserWithRole = Prisma.usersGetPayload<{ include: { roles: true } }>;

// Verified when the email does not match any user, so lookups for existing
// and non-existing accounts take the same time (no user enumeration).
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$/V+G/AVODG0BwUolltrgFw$2Le1XE9Z9xy6Akj1IYV0+NdR9KROZn6IPxKsFKYzGIU';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithRole | null> {
    // Emails are stored lowercased; the DB enforces uniqueness on lower(email).
    const user = await this.prisma.users.findFirst({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
    if (!user) {
      await argon2.verify(DUMMY_PASSWORD_HASH, password).catch(() => false);
      return null;
    }
    const valid = await argon2.verify(user.password_hash, password);
    return valid ? user : null;
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.users.findUnique({
      where: { id },
      include: { roles: true },
    });
  }

  toAuthResponse(user: UserWithRole, csrfToken: string) {
    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.roles.name,
        organization_id: user.organization_id,
      },
      csrf_token: csrfToken,
    };
  }
}
