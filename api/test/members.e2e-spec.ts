import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import type { EmailCodePurpose } from './../src/auth/email-codes.service';
import { EmailService } from './../src/auth/email.service';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  cleanupOrgs,
  createOrgWithOwner,
  loginAgent,
  TestAgent,
} from './helpers';

interface Member {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: 'active' | 'invited';
}

describe('Members (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: TestAgent;
  let organizationId: string;
  const organizationIds: string[] = [];

  // Emails captured instead of sent.
  const codes = new Map<string, string>();
  const invitations: { to: string; organizationName: string }[] = [];
  const memberEmail = `e2e-member-${Date.now()}@test.local`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue({
        sendCode: (to: string, purpose: EmailCodePurpose, code: string) => {
          codes.set(`${to}:${purpose}`, code);
          return Promise.resolve();
        },
        sendInvitation: (
          to: string,
          _inviterName: string,
          organizationName: string,
        ) => {
          invitations.push({ to, organizationName });
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    organizationId = await createOrgWithOwner(prisma, 'members');
    organizationIds.push(organizationId);
    ({ agent: owner } = await loginAgent(app, prisma, organizationId));
  });

  afterAll(async () => {
    await cleanupOrgs(prisma, organizationIds);
    await app.close();
  });

  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(`/api/v1/auth/${path}`).send(body);

  async function signInWithCode(email: string): Promise<TestAgent> {
    await post('otp/request', { email }).expect(204);
    const response = await post('otp/verify', {
      email,
      code: codes.get(`${email}:login`),
    }).expect(200);
    const { access_token } = response.body as { access_token: string };
    return request
      .agent(app.getHttpServer())
      .set('Authorization', `Bearer ${access_token}`);
  }

  it('lists the owner as the only member at first', async () => {
    const response = await owner.get('/api/v1/members').expect(200);
    const { data } = response.body as { data: Member[] };
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ role: 'owner', status: 'active' });
  });

  it('invites a member, who joins the same organization with a code', async () => {
    const invited = await owner
      .post('/api/v1/members')
      .send({ full_name: 'Papá', email: memberEmail.toUpperCase() })
      .expect(201);
    expect(invited.body as Member).toMatchObject({
      email: memberEmail,
      role: 'member',
      status: 'invited',
    });
    expect(invitations).toEqual([expect.objectContaining({ to: memberEmail })]);

    const member = await signInWithCode(memberEmail);
    const me = await member.get('/api/v1/auth/me').expect(200);
    expect(me.body).toMatchObject({
      user: { organization_id: organizationId, role: 'member' },
    });

    // Same organization: the owner's farm is visible to the member.
    const farm = await owner
      .post('/api/v1/farms')
      .send({ name: 'Fundo compartido' })
      .expect(201);
    const farms = await member.get('/api/v1/farms').expect(200);
    expect((farms.body as { data: { id: string }[] }).data).toEqual([
      expect.objectContaining({ id: (farm.body as { id: string }).id }),
    ]);

    const list = await owner.get('/api/v1/members').expect(200);
    expect((list.body as { data: Member[] }).data).toContainEqual(
      expect.objectContaining({ email: memberEmail, status: 'active' }),
    );
  });

  it('rejects inviting an email that already has an account', () => {
    return owner
      .post('/api/v1/members')
      .send({ full_name: 'Otra vez', email: memberEmail })
      .expect(409);
  });

  it('only lets the owner manage members', async () => {
    const member = await signInWithCode(memberEmail);
    await member.get('/api/v1/members').expect(200);
    await member
      .post('/api/v1/members')
      .send({ full_name: 'Vecino', email: 'vecino@test.local' })
      .expect(403);

    const { data } = (await member.get('/api/v1/members')).body as {
      data: Member[];
    };
    const ownerRow = data.find((m) => m.role === 'owner')!;
    await member.delete(`/api/v1/members/${ownerRow.id}`).expect(403);
  });

  it('removes a member and signs them out', async () => {
    const { data } = (await owner.get('/api/v1/members')).body as {
      data: Member[];
    };
    const memberRow = data.find((m) => m.email === memberEmail)!;
    const ownerRow = data.find((m) => m.role === 'owner')!;

    await owner.delete(`/api/v1/members/${ownerRow.id}`).expect(400);
    await owner.delete(`/api/v1/members/${memberRow.id}`).expect(204);
    await owner.delete(`/api/v1/members/${memberRow.id}`).expect(404);

    const remaining = await owner.get('/api/v1/members').expect(200);
    expect((remaining.body as { data: Member[] }).data).toHaveLength(1);
    expect(
      await prisma.users.findFirst({ where: { email: memberEmail } }),
    ).toBeNull();
  });
});
