import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';

export type TestAgent = ReturnType<typeof request.agent>;

export const TEST_PASSWORD = 'correct horse battery staple';

let sequence = 0;

export async function createOrgWithOwner(
  prisma: PrismaService,
  label: string,
): Promise<string> {
  const unique = `${label}-${Date.now()}-${sequence++}`;
  const organization = await prisma.organizations.create({
    data: { name: `E2E ${unique}` },
  });
  await prisma.users.create({
    data: {
      organization_id: organization.id,
      role_id: 1, // owner
      email: `e2e-${unique}@test.local`.toLowerCase(),
      password_hash: await argon2.hash(TEST_PASSWORD, {
        type: argon2.argon2id,
      }),
      full_name: `E2E ${label}`,
      email_verified_at: new Date(),
    },
  });
  return organization.id;
}

export async function loginAgent(
  app: INestApplication<App>,
  prisma: PrismaService,
  organizationId: string,
): Promise<{ agent: TestAgent; csrf: string }> {
  const user = await prisma.users.findFirst({
    where: { organization_id: organizationId },
  });
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post('/api/v1/auth/login')
    .send({ email: user!.email, password: TEST_PASSWORD })
    .expect(200);
  return {
    agent,
    csrf: (response.body as { csrf_token: string }).csrf_token,
  };
}

// Hard-deletes everything the e2e suites created, in FK-safe order.
export async function cleanupOrgs(
  prisma: PrismaService,
  organizationIds: string[],
): Promise<void> {
  const inOrgs = { organization_id: { in: organizationIds } };
  await prisma.animal_identifiers.deleteMany({ where: inOrgs });
  await prisma.animals.deleteMany({ where: inOrgs });
  await prisma.breeds.deleteMany({ where: inOrgs });
  await prisma.farms.deleteMany({ where: inOrgs });
  await prisma.users.deleteMany({ where: inOrgs });
  await prisma.organizations.deleteMany({
    where: { id: { in: organizationIds } },
  });
}
