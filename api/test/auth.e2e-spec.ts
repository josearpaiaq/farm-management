import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { TokensService } from './../src/auth/tokens.service';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponse {
  user: { email: string; role: string };
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// Value of the refresh_token cookie in a response, or undefined.
function refreshCookie(response: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('refresh_token='));
  return cookie?.split(';')[0].slice('refresh_token='.length) || undefined;
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
        email_verified_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Deleting the user cascades its refresh tokens.
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

  const http = () => request(app.getHttpServer());
  // Issues a fresh login (token family) directly, so these tests stay under
  // the per-IP rate limit on POST /auth/login.
  const issueRefresh = async () => {
    const user = await prisma.users.findFirstOrThrow({ where: { email } });
    return (await app.get(TokensService).issue(user)).refreshToken;
  };
  const me = (accessToken: string) =>
    http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

  it('rejects a tampered access token', async () => {
    await me('not-a-jwt').expect(401);
  });

  it('web login: access token in the body, refresh token in an httpOnly cookie', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const body = login.body as AuthResponse;
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('owner');
    expect(body.token_type).toBe('Bearer');
    expect(body.expires_in).toBe(900);
    expect(body.refresh_token).toBeUndefined();

    const setCookie = ([] as string[]).concat(login.headers['set-cookie']);
    expect(setCookie[0]).toMatch(/HttpOnly/);
    expect(setCookie[0]).toMatch(/SameSite=Strict/);
    expect(setCookie[0]).toMatch(/Path=\/api\/v1\/auth/);

    const meResponse = await me(body.access_token).expect(200);
    expect((meResponse.body as AuthResponse).user.email).toBe(email);
  });

  it('refreshes from the cookie, rotating the refresh token', async () => {
    const first = await issueRefresh();

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${first}`)
      .expect(200);
    const second = refreshCookie(refreshed)!;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    await me((refreshed.body as AuthResponse).access_token).expect(200);
  });

  it('native clients get and send the refresh token in the body', async () => {
    const login = await http()
      .post('/api/v1/auth/login')
      .set('X-Auth-Transport', 'body')
      .send({ email, password })
      .expect(200);
    expect(refreshCookie(login)).toBeUndefined();
    const { refresh_token } = login.body as AuthResponse;
    expect(refresh_token).toEqual(expect.any(String));

    const refreshed = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Auth-Transport', 'body')
      .send({ refresh_token })
      .expect(200);
    expect((refreshed.body as AuthResponse).refresh_token).not.toBe(
      refresh_token,
    );
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const stolen = await issueRefresh();
    const rotated = await http()
      .post('/api/v1/auth/refresh')
      .set('X-Auth-Transport', 'body')
      .send({ refresh_token: stolen })
      .expect(200);
    const current = (rotated.body as AuthResponse).refresh_token!;

    // Inside the grace window a reused token is only rejected (concurrent
    // refresh from another tab), and the legitimate token keeps working.
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: stolen })
      .expect(401);

    // Past the grace window, reuse means theft: the family is revoked.
    await prisma.refresh_tokens.updateMany({
      where: { revoked_at: { not: null }, users: { email } },
      data: { revoked_at: new Date(Date.now() - 60_000) },
    });
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: stolen })
      .expect(401);
    await http()
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: current })
      .expect(401);
  });

  it('logout revokes the refresh token and clears the cookie', async () => {
    const token = await issueRefresh();

    const logout = await http()
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${token}`)
      .expect(204);
    expect(([] as string[]).concat(logout.headers['set-cookie'])[0]).toMatch(
      /refresh_token=;/,
    );
    await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${token}`)
      .expect(401);
  });
});
