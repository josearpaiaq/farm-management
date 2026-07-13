import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

interface RecordList {
  data: Record<string, unknown>[];
  total: number;
}

interface ApiError {
  error: string;
  details?: { field: string; message: string }[];
}

describe('Animal records (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const organizationIds: string[] = [];
  let agentA: TestAgent;
  let csrfA: string;
  let agentB: TestAgent;
  let csrfB: string;
  let animalId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    organizationIds.push(await createOrgWithOwner(prisma, 'records-A'));
    organizationIds.push(await createOrgWithOwner(prisma, 'records-B'));
    ({ agent: agentA, csrf: csrfA } = await loginAgent(
      app,
      prisma,
      organizationIds[0],
    ));
    ({ agent: agentB, csrf: csrfB } = await loginAgent(
      app,
      prisma,
      organizationIds[1],
    ));

    const farm = await prisma.farms.create({
      data: { organization_id: organizationIds[0], name: 'Finca Records' },
    });
    animalId = (
      await prisma.animals.create({
        data: {
          organization_id: organizationIds[0],
          farm_id: farm.id,
          species: 'cattle',
          sex: 'female',
        },
      })
    ).id;
  });

  afterAll(async () => {
    const inAnimal = { animal_id: animalId };
    await prisma.weight_records.deleteMany({ where: inAnimal });
    await prisma.health_events.deleteMany({ where: inAnimal });
    await prisma.notes.deleteMany({ where: inAnimal });
    await cleanupOrgs(prisma, organizationIds);
    await app.close();
  });

  it('logs weights, lists them newest first, and soft-deletes mistakes', async () => {
    const first = await agentA
      .post(`/api/v1/animals/${animalId}/weights`)
      .set('X-CSRF-Token', csrfA)
      .send({ weight_kg: 320.5, recorded_on: '2026-05-01' })
      .expect(201);
    await agentA
      .post(`/api/v1/animals/${animalId}/weights`)
      .set('X-CSRF-Token', csrfA)
      .send({ weight_kg: 335, recorded_on: '2026-06-01' })
      .expect(201);

    const list = await agentA
      .get(`/api/v1/animals/${animalId}/weights`)
      .expect(200);
    const body = list.body as RecordList;
    expect(body.total).toBe(2);
    expect(Number(body.data[0].weight_kg)).toBe(335);
    expect(Number(body.data[1].weight_kg)).toBe(320.5);

    // A record entered by mistake is soft-deleted and disappears.
    const firstId = (first.body as { id: string }).id;
    await agentA
      .delete(`/api/v1/animals/${animalId}/weights/${firstId}`)
      .set('X-CSRF-Token', csrfA)
      .expect(204);
    const after = await agentA
      .get(`/api/v1/animals/${animalId}/weights`)
      .expect(200);
    expect((after.body as RecordList).total).toBe(1);
  });

  it('rejects invalid weights and future dates', async () => {
    await agentA
      .post(`/api/v1/animals/${animalId}/weights`)
      .set('X-CSRF-Token', csrfA)
      .send({ weight_kg: -5, recorded_on: '2026-06-01' })
      .expect(422);

    const future = await agentA
      .post(`/api/v1/animals/${animalId}/weights`)
      .set('X-CSRF-Token', csrfA)
      .send({ weight_kg: 300, recorded_on: '2030-01-01' })
      .expect(422);
    expect((future.body as ApiError).details).toEqual([
      expect.objectContaining({ field: 'recorded_on' }),
    ]);
  });

  it('logs health events with withdrawal validation', async () => {
    await agentA
      .post(`/api/v1/animals/${animalId}/health-events`)
      .set('X-CSRF-Token', csrfA)
      .send({
        event_type: 'vaccination',
        occurred_on: '2026-06-10',
        product: 'Aftosa',
        withdrawal_until: '2026-07-10',
      })
      .expect(201);

    // Withdrawal cannot end before the event happened.
    const invalid = await agentA
      .post(`/api/v1/animals/${animalId}/health-events`)
      .set('X-CSRF-Token', csrfA)
      .send({
        event_type: 'treatment',
        occurred_on: '2026-06-10',
        withdrawal_until: '2026-06-01',
      })
      .expect(422);
    expect((invalid.body as ApiError).details).toEqual([
      expect.objectContaining({ field: 'withdrawal_until' }),
    ]);

    // Unknown event type.
    await agentA
      .post(`/api/v1/animals/${animalId}/health-events`)
      .set('X-CSRF-Token', csrfA)
      .send({ event_type: 'exorcism', occurred_on: '2026-06-10' })
      .expect(422);

    const list = await agentA
      .get(`/api/v1/animals/${animalId}/health-events`)
      .expect(200);
    expect((list.body as RecordList).total).toBe(1);
    expect((list.body as RecordList).data[0].product).toBe('Aftosa');
  });

  it('adds and lists notes', async () => {
    await agentA
      .post(`/api/v1/animals/${animalId}/notes`)
      .set('X-CSRF-Token', csrfA)
      .send({ body: 'Cojea levemente de la pata trasera izquierda' })
      .expect(201);

    await agentA
      .post(`/api/v1/animals/${animalId}/notes`)
      .set('X-CSRF-Token', csrfA)
      .send({ body: '' })
      .expect(422);

    const list = await agentA
      .get(`/api/v1/animals/${animalId}/notes`)
      .expect(200);
    expect((list.body as RecordList).total).toBe(1);
  });

  it("hides another organization's animal entirely", async () => {
    await agentB.get(`/api/v1/animals/${animalId}/weights`).expect(404);
    await agentB
      .post(`/api/v1/animals/${animalId}/weights`)
      .set('X-CSRF-Token', csrfB)
      .send({ weight_kg: 100, recorded_on: '2026-06-01' })
      .expect(404);
  });
});
