import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  cleanupOrgs,
  createOrgWithOwner,
  loginAgent,
  TestAgent,
} from './helpers';

interface BreedList {
  data: { id: string; species: string; name: string }[];
  total: number;
}

describe('Breeds (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const organizationIds: string[] = [];
  let agentA: TestAgent;
  let agentB: TestAgent;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    organizationIds.push(await createOrgWithOwner(prisma, 'breeds-A'));
    organizationIds.push(await createOrgWithOwner(prisma, 'breeds-B'));
    ({ agent: agentA } = await loginAgent(app, prisma, organizationIds[0]));
    ({ agent: agentB } = await loginAgent(app, prisma, organizationIds[1]));
  });

  afterAll(async () => {
    await cleanupOrgs(prisma, organizationIds);
    await app.close();
  });

  it('requires a session', () => {
    return request(app.getHttpServer()).get('/api/v1/breeds').expect(401);
  });

  it('rejects an unknown species with 422', async () => {
    await agentA
      .post('/api/v1/breeds')
      .send({ species: 'dragon', name: 'Fire' })
      .expect(422);
  });

  it('creates breeds, rejects duplicates per (species, name), and isolates per org', async () => {
    await agentA
      .post('/api/v1/breeds')
      .send({ species: 'cattle', name: 'Brahman' })
      .expect(201);

    // Same name, same species: conflict.
    await agentA
      .post('/api/v1/breeds')
      .send({ species: 'cattle', name: 'Brahman' })
      .expect(409);

    // Same name, different species: fine.
    await agentA
      .post('/api/v1/breeds')
      .send({ species: 'goat', name: 'Brahman' })
      .expect(201);

    const all = await agentA.get('/api/v1/breeds').expect(200);
    expect((all.body as BreedList).total).toBe(2);

    const cattleOnly = await agentA
      .get('/api/v1/breeds?species=cattle')
      .expect(200);
    expect((cattleOnly.body as BreedList).total).toBe(1);
    expect((cattleOnly.body as BreedList).data[0].name).toBe('Brahman');

    const foreign = await agentB.get('/api/v1/breeds').expect(200);
    expect((foreign.body as BreedList).total).toBe(0);
  });
});
