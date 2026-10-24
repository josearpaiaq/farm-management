import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import type { EmailCodePurpose } from './../src/auth/email-codes.service';
import { EmailService } from './../src/auth/email.service';
import { PrismaService } from './../src/prisma/prisma.service';

interface AuthResponse {
  user: { email: string; role: string; organization_id: string };
  access_token: string;
}

describe('Auth flows: register, email codes, password reset (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  // Last code "sent" per email and purpose, captured instead of emailing.
  const sent = new Map<string, string>();
  const lastCode = (email: string, purpose: EmailCodePurpose) =>
    sent.get(`${email}:${purpose}`)!;

  const email = `e2e-flows-${Date.now()}@test.local`;
  const password = 'correct horse battery staple';
  const newPassword = 'a brand new password';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendCode: (to: string, purpose: EmailCodePurpose, code: string) => {
          sent.set(`${to}:${purpose}`, code);
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.users.findFirst({ where: { email } });
    if (user) {
      await prisma.email_codes.deleteMany({ where: { user_id: user.id } });
      await prisma.users.delete({ where: { id: user.id } });
      await prisma.organizations.delete({
        where: { id: user.organization_id },
      });
    }
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send(body);
  const me = (accessToken: string) =>
    request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

  it('rejects a weak registration with 422', () => {
    return post('register', {
      full_name: 'E2E',
      organization_name: 'E2E Org',
      email,
      password: 'short',
    }).expect(422);
  });

  it('registers an unverified owner of a new organization', async () => {
    await post('register', {
      full_name: 'E2E Flows',
      organization_name: 'E2E Flows Org',
      email,
      password,
    }).expect(204);
    expect(lastCode(email, 'verify_email')).toMatch(/^\d{6}$/);

    await post('register', {
      full_name: 'Again',
      organization_name: 'Again',
      email,
      password,
    }).expect(409);
  });

  it('blocks password login until the email is verified', async () => {
    const before = lastCode(email, 'verify_email');
    await post('login', { email, password }).expect(403);
    // A fresh verification code is issued on the blocked login.
    expect(lastCode(email, 'verify_email')).not.toBe(before);
  });

  it('verifies the email with the code and signs the user in', async () => {
    await post('verify-email', { email, code: '000000' }).expect(401);

    const response = await post('verify-email', {
      email,
      code: lastCode(email, 'verify_email'),
    }).expect(200);
    const body = response.body as AuthResponse;
    expect(body.user.email).toBe(email);
    expect(body.user.role).toBe('owner');
    await me(body.access_token).expect(200);

    // Codes are single use.
    await post('verify-email', {
      email,
      code: lastCode(email, 'verify_email'),
    }).expect(401);
    await post('login', { email, password }).expect(200);
  });

  it('logs in with an emailed one-time code', async () => {
    await post('otp/request', { email: 'nobody@test.local' }).expect(204);
    await post('otp/request', { email }).expect(204);

    const response = await post('otp/verify', {
      email,
      code: lastCode(email, 'login'),
    }).expect(200);
    await me((response.body as AuthResponse).access_token).expect(200);
  });

  it('locks a code after too many wrong attempts', async () => {
    await post('otp/request', { email }).expect(204);
    const code = lastCode(email, 'login');
    const wrong = code === '111111' ? '222222' : '111111';
    // Simulate four earlier wrong guesses (guessing for real would hit the
    // per-IP rate limit first).
    const user = await prisma.users.findFirstOrThrow({ where: { email } });
    await prisma.email_codes.updateMany({
      where: { user_id: user.id, purpose: 'login' },
      data: { attempts: 4 },
    });
    await post('otp/verify', { email, code: wrong }).expect(401);
    await post('otp/verify', { email, code }).expect(401);
  });

  it('resets the password and revokes every refresh token', async () => {
    const oldLogin = await post('login', { email, password })
      .set('X-Auth-Transport', 'body')
      .expect(200);
    const oldRefresh = (oldLogin.body as { refresh_token: string })
      .refresh_token;

    await post('password/forgot', { email: 'nobody@test.local' }).expect(204);
    await post('password/forgot', { email }).expect(204);
    await post('password/reset', {
      email,
      code: lastCode(email, 'reset_password'),
      password: newPassword,
    }).expect(200);

    await post('refresh', { refresh_token: oldRefresh }).expect(401);
    await post('login', { email, password }).expect(401);
  });
});
