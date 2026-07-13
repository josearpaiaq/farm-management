import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

type TestAgent = ReturnType<typeof request.agent>;

interface Farm {
  id: string;
  name: string;
  location: string | null;
  organization_id: string;
}

interface FarmList {
  data: Farm[];
  total: number;
  limit: number;
  offset: number;
}

interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: { field: string; message: string }[];
}

describe('Farms (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'correct horse battery staple';
  const organizationIds: string[] = [];

  let agentA: TestAgent;
  let csrfA: string;
  let agentB: TestAgent;

  async function createOrgWithOwner(label: string): Promise<string> {
    const organization = await prisma.organizations.create({
      data: { name: `E2E Farms ${label} ${Date.now()}` },
    });
    organizationIds.push(organization.id);
    await prisma.users.create({
      data: {
        organization_id: organization.id,
        role_id: 1,
        email: `e2e-farms-${label}-${Date.now()}@test.local`.toLowerCase(),
        password_hash: await argon2.hash(password, { type: argon2.argon2id }),
        full_name: `E2E ${label}`,
      },
    });
    return organization.id;
  }

  async function login(organizationId: string): Promise<{
    agent: TestAgent;
    csrf: string;
  }> {
    const user = await prisma.users.findFirst({
      where: { organization_id: organizationId },
    });
    const agent = request.agent(app.getHttpServer());
    const response = await agent
      .post('/api/v1/auth/login')
      .send({ email: user!.email, password })
      .expect(200);
    return {
      agent,
      csrf: (response.body as { csrf_token: string }).csrf_token,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const orgA = await createOrgWithOwner('A');
    await createOrgWithOwner('B');
    ({ agent: agentA, csrf: csrfA } = await login(orgA));
    ({ agent: agentB } = await login(organizationIds[1]));
  });

  afterAll(async () => {
    await prisma.animals.deleteMany({
      where: { organization_id: { in: organizationIds } },
    });
    await prisma.farms.deleteMany({
      where: { organization_id: { in: organizationIds } },
    });
    await prisma.users.deleteMany({
      where: { organization_id: { in: organizationIds } },
    });
    await prisma.organizations.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await app.close();
  });

  it('requires a session', () => {
    return request(app.getHttpServer()).get('/api/v1/farms').expect(401);
  });

  it('rejects an empty name with field-level details', async () => {
    const response = await agentA
      .post('/api/v1/farms')
      .set('X-CSRF-Token', csrfA)
      .send({ name: '' })
      .expect(422);
    const body = response.body as ApiError;
    expect(body.error).toBe('validation_error');
    expect(body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
    );
  });

  it('creates, lists, reads, updates, and isolates farms per organization', async () => {
    // Create (server-generated id).
    const created = await agentA
      .post('/api/v1/farms')
      .set('X-CSRF-Token', csrfA)
      .send({ name: 'La Esperanza', location: 'Km 12 vía al llano' })
      .expect(201);
    const farm = created.body as Farm;
    expect(farm.organization_id).toBe(organizationIds[0]);

    // Create with a client-generated id; retrying the same id conflicts.
    const clientId = randomUUID();
    await agentA
      .post('/api/v1/farms')
      .set('X-CSRF-Token', csrfA)
      .send({ id: clientId, name: 'El Paraíso' })
      .expect(201);
    const duplicate = await agentA
      .post('/api/v1/farms')
      .set('X-CSRF-Token', csrfA)
      .send({ id: clientId, name: 'El Paraíso' })
      .expect(409);
    expect((duplicate.body as ApiError).error).toBe('conflict');

    // List is org-scoped with a total count.
    const listA = await agentA.get('/api/v1/farms').expect(200);
    expect((listA.body as FarmList).total).toBe(2);
    const listB = await agentB.get('/api/v1/farms').expect(200);
    expect((listB.body as FarmList).total).toBe(0);

    // Another organization cannot reach the farm by id.
    await agentB.get(`/api/v1/farms/${farm.id}`).expect(404);

    // Mutations require the CSRF header.
    await agentA
      .patch(`/api/v1/farms/${farm.id}`)
      .send({ name: 'La Esperanza II' })
      .expect(403);
    const updated = await agentA
      .patch(`/api/v1/farms/${farm.id}`)
      .set('X-CSRF-Token', csrfA)
      .send({ name: 'La Esperanza II' })
      .expect(200);
    expect((updated.body as Farm).name).toBe('La Esperanza II');
    expect((updated.body as Farm).location).toBe('Km 12 vía al llano');
  });

  it('refuses to delete a farm that still has animals', async () => {
    const created = await agentA
      .post('/api/v1/farms')
      .set('X-CSRF-Token', csrfA)
      .send({ name: 'Potrero Norte' })
      .expect(201);
    const farm = created.body as Farm;

    const animal = await prisma.animals.create({
      data: {
        organization_id: organizationIds[0],
        farm_id: farm.id,
        species: 'cattle',
        sex: 'female',
      },
    });

    const conflict = await agentA
      .delete(`/api/v1/farms/${farm.id}`)
      .set('X-CSRF-Token', csrfA)
      .expect(409);
    expect((conflict.body as ApiError).error).toBe('conflict');

    await prisma.animals.delete({ where: { id: animal.id } });
    await agentA
      .delete(`/api/v1/farms/${farm.id}`)
      .set('X-CSRF-Token', csrfA)
      .expect(204);
    await agentA.get(`/api/v1/farms/${farm.id}`).expect(404);
  });
});
