import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { EmailService } from '../auth/email.service';
import { PrismaService } from '../prisma/prisma.service';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberDto } from './dto/update-member.dto';

// Roles the owner can give to other people (ids from the roles table).
export const MEMBER_ROLES = ['viewer', 'editor'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const OWNER_ROLE_ID = 1;
const ROLE_IDS: Record<MemberRole, number> = { viewer: 2, editor: 3 };

type MemberRow = Prisma.usersGetPayload<{ include: { roles: true } }>;

// People who share an organization. Anyone in it can see the list; only the
// owner invites, changes roles and removes. Invited members get no password:
// they sign in with an emailed code (which also verifies their email) and can
// set a password later through "forgot password".
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async list(organizationId: string) {
    const users = await this.prisma.users.findMany({
      where: { organization_id: organizationId },
      include: { roles: true },
      // The owner signed up first, so they lead the list.
      orderBy: { created_at: 'asc' },
    });
    return { data: users.map(toMember) };
  }

  async invite(organizationId: string, userId: string, dto: InviteMemberDto) {
    const owner = await this.assertOwner(organizationId, userId);
    const email = dto.email.toLowerCase();
    // Users belong to exactly one organization.
    if (await this.prisma.users.findFirst({ where: { email } })) {
      throw new ConflictException('Email already registered');
    }
    // Unusable random password until the member sets one.
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
    });
    let member: MemberRow;
    try {
      member = await this.prisma.users.create({
        data: {
          organization_id: organizationId,
          role_id: ROLE_IDS[dto.role ?? 'viewer'],
          email,
          password_hash: passwordHash,
          full_name: dto.full_name,
        },
        include: { roles: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already registered');
      }
      throw error;
    }
    await this.email.sendInvitation(
      email,
      owner.full_name,
      owner.organizations.name,
    );
    return toMember(member);
  }

  // Takes effect at the member's next token refresh (<= 15 minutes).
  async update(
    organizationId: string,
    userId: string,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    await this.assertOwner(organizationId, userId);
    await this.findOtherMember(organizationId, userId, memberId);
    const member = await this.prisma.users.update({
      where: { id: memberId },
      data: { role_id: ROLE_IDS[dto.role] },
      include: { roles: true },
    });
    return toMember(member);
  }

  async remove(organizationId: string, userId: string, memberId: string) {
    await this.assertOwner(organizationId, userId);
    await this.findOtherMember(organizationId, userId, memberId);
    await this.prisma.$transaction([
      // Keep their CSV imports, just forget who uploaded them.
      this.prisma.import_jobs.updateMany({
        where: { created_by: memberId },
        data: { created_by: null },
      }),
      // Cascades to email_codes and refresh_tokens, so they are signed out
      // as soon as their current access token expires.
      this.prisma.users.delete({ where: { id: memberId } }),
    ]);
  }

  // The owner's own row is off limits: a farm always keeps its owner.
  private async findOtherMember(
    organizationId: string,
    userId: string,
    memberId: string,
  ) {
    if (memberId === userId) {
      throw new BadRequestException('The owner cannot change themselves');
    }
    const member = await this.prisma.users.findFirst({
      where: { id: memberId, organization_id: organizationId },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  private async assertOwner(organizationId: string, userId: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, organization_id: organizationId },
      include: { organizations: true },
    });
    if (user?.role_id !== OWNER_ROLE_ID) {
      throw new ForbiddenException('Only the owner can manage members');
    }
    return user;
  }
}

function toMember(user: MemberRow) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.roles.name,
    // Invited members stay pending until their first code sign-in.
    status: user.email_verified_at ? 'active' : 'invited',
    created_at: user.created_at,
  };
}
