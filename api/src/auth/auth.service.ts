import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailCodePurpose, EmailCodesService } from './email-codes.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { TokensService } from './tokens.service';

type UserWithRole = Prisma.usersGetPayload<{ include: { roles: true } }>;

// Verified when the email does not match any user, so lookups for existing
// and non-existing accounts take the same time (no user enumeration).
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$/V+G/AVODG0BwUolltrgFw$2Le1XE9Z9xy6Akj1IYV0+NdR9KROZn6IPxKsFKYzGIU';

const OWNER_ROLE_ID = 1;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailCodes: EmailCodesService,
    private readonly email: EmailService,
    private readonly tokens: TokensService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithRole | null> {
    const user = await this.findByEmail(email);
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

  async findByEmail(email: string): Promise<UserWithRole | null> {
    // Emails are stored lowercased; the DB enforces uniqueness on lower(email).
    return this.prisma.users.findFirst({
      where: { email: email.toLowerCase() },
      include: { roles: true },
    });
  }

  // Self-service sign-up: a new organization with the user as its owner.
  // The account stays unverified until the emailed code is confirmed.
  async register(dto: RegisterDto): Promise<UserWithRole> {
    const email = dto.email.toLowerCase();
    if (await this.findByEmail(email)) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organizations.create({
          data: { name: dto.organization_name },
        });
        return tx.users.create({
          data: {
            organization_id: organization.id,
            role_id: OWNER_ROLE_ID,
            email,
            password_hash: passwordHash,
            full_name: dto.full_name,
          },
          include: { roles: true },
        });
      });
    } catch (error) {
      // Lost a race with a concurrent sign-up for the same email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
  }

  async sendCode(user: UserWithRole, purpose: EmailCodePurpose): Promise<void> {
    const code = await this.emailCodes.issue(user.id, purpose);
    await this.email.sendCode(user.email, purpose, code);
  }

  // Looks up the user and consumes the code; null when either is invalid.
  async consumeCode(
    email: string,
    purpose: EmailCodePurpose,
    code: string,
  ): Promise<UserWithRole | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    const valid = await this.emailCodes.consume(user.id, purpose, code);
    return valid ? user : null;
  }

  // Receiving any code proves ownership of the email.
  async markEmailVerified(user: UserWithRole): Promise<void> {
    if (user.email_verified_at) return;
    await this.prisma.users.update({
      where: { id: user.id },
      data: { email_verified_at: new Date() },
    });
  }

  // Sets a new password and signs the user out everywhere else.
  async resetPassword(user: UserWithRole, password: string): Promise<void> {
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        password_hash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    await this.tokens.revokeAllForUser(user.id);
  }

  toUserResponse(user: UserWithRole) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.roles.name,
      organization_id: user.organization_id,
    };
  }
}
