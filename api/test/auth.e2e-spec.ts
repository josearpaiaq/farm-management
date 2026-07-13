import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponse {
  user: { email: string; role: string };
  csrf_token: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let organizationId: string;
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    const organization = await prisma.organizations.create({
      data: { name: `E2E Org ${Date.now()}` },
    });
    organizationId = organization.id;
    await prisma.users.create({
      data: {
        organization_id: organizationId,
        role_id: 1, // owner
        email,
        password_hash: await argon2.hash(password, { type: argon2.argon2id }),
        full_name: 'E2E Owner',
      },
    });
  });

  afterAll(async () => {
    await prisma.users.deleteMany({
      where: { organization_id: organizationId },
    });
    await prisma.organizations.delete({ where: { id: organizationId } });
    await app.close();
  });

  it('rejects a malformed login body with 422', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' })
      .expect(422);
  });

  it('rejects wrong credentials with 401', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('rejects /auth/me without a session', () => {
    return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('logs in, reads /me, enforces CSRF on logout, and logs out', async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const loginBody = login.body as AuthResponse;
    expect(loginBody.user.email).toBe(email);
    expect(loginBody.user.role).toBe('owner');
    expect(loginBody.csrf_token).toEqual(expect.any(String));
    const csrfToken = loginBody.csrf_token;

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect((me.body as AuthResponse).user.email).toBe(email);

    // Mutating request without the CSRF header must be rejected.
    await agent.post('/api/v1/auth/logout').expect(403);

    await agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', csrfToken)
      .expect(204);

    await agent.get('/api/v1/auth/me').expect(401);
  });
});
