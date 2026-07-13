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

interface AnimalDetail {
  id: string;
  species: string;
  sex: string;
  status: string;
  birth_date: string | null;
  tag: string | null;
  identifiers: { id_type: string; value: string; is_primary: boolean }[];
  breed: { id: string; name: string } | null;
  farm: { id: string; name: string };
}

interface AnimalList {
  data: AnimalDetail[];
  total: number;
}

interface ApiError {
  error: string;
  details?: { field: string; message: string }[];
}

interface HerdStats {
  total: number;
  by_status: Record<string, number>;
  by_species: Record<string, number>;
}

function fields(body: unknown): string[] {
  return ((body as ApiError).details ?? []).map((detail) => detail.field);
}

describe('Animals (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const organizationIds: string[] = [];
  let agentA: TestAgent;
  let csrfA: string;
  let agentB: TestAgent;

  let farmA: string;
  let farmB: string;
  let cattleBreed: string;
  let goatBreed: string;

  async function createAnimal(
    payload: Record<string, unknown>,
    expected = 201,
  ) {
    const response = await agentA
      .post('/api/v1/animals')
      .set('X-CSRF-Token', csrfA)
      .send(payload)
      .expect(expected);
    return response.body as AnimalDetail & ApiError;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    organizationIds.push(await createOrgWithOwner(prisma, 'animals-A'));
    organizationIds.push(await createOrgWithOwner(prisma, 'animals-B'));
    ({ agent: agentA, csrf: csrfA } = await loginAgent(
      app,
      prisma,
      organizationIds[0],
    ));
    ({ agent: agentB } = await loginAgent(app, prisma, organizationIds[1]));

    farmA = (
      await prisma.farms.create({
        data: { organization_id: organizationIds[0], name: 'Finca A' },
      })
    ).id;
    farmB = (
      await prisma.farms.create({
        data: { organization_id: organizationIds[1], name: 'Finca B' },
      })
    ).id;
    cattleBreed = (
      await prisma.breeds.create({
        data: {
          organization_id: organizationIds[0],
          species: 'cattle',
          name: 'Brahman',
        },
      })
    ).id;
    goatBreed = (
      await prisma.breeds.create({
        data: {
          organization_id: organizationIds[0],
          species: 'goat',
          name: 'Boer',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupOrgs(prisma, organizationIds);
    await app.close();
  });

  it('creates an animal with its primary tag atomically', async () => {
    const animal = await createAnimal({
      farm_id: farmA,
      species: 'cattle',
      sex: 'female',
      tag: 'A-001',
      breed_id: cattleBreed,
      birth_date: '2023-05-01',
    });

    expect(animal.tag).toBe('A-001');
    expect(animal.status).toBe('active');
    expect(animal.birth_date).toContain('2023-05-01');
    expect(animal.breed?.name).toBe('Brahman');
    expect(animal.farm.name).toBe('Finca A');
    expect(animal.identifiers).toEqual([
      expect.objectContaining({
        id_type: 'tag',
        value: 'A-001',
        is_primary: true,
      }),
    ]);
  });

  it('rejects cross-org and incoherent references with field details', async () => {
    // Foreign farm + future birth date, reported together.
    const both = await createAnimal(
      {
        farm_id: farmB,
        species: 'cattle',
        sex: 'male',
        tag: 'A-002',
        birth_date: '2030-01-01',
      },
      422,
    );
    expect(fields(both)).toEqual(
      expect.arrayContaining(['farm_id', 'birth_date']),
    );

    // Breed of another species.
    const mismatch = await createAnimal(
      {
        farm_id: farmA,
        species: 'cattle',
        sex: 'male',
        tag: 'A-002',
        breed_id: goatBreed,
      },
      422,
    );
    expect(fields(mismatch)).toEqual(['breed_id']);
  });

  it('rejects a duplicate tag within the organization', async () => {
    const duplicate = await createAnimal(
      { farm_id: farmA, species: 'cattle', sex: 'male', tag: 'A-001' },
      409,
    );
    expect(duplicate.error).toBe('conflict');
  });

  it('links genealogy and validates parent sex', async () => {
    const dam = await createAnimal({
      farm_id: farmA,
      species: 'cattle',
      sex: 'female',
      tag: 'DAM-1',
    });
    const sire = await createAnimal({
      farm_id: farmA,
      species: 'cattle',
      sex: 'male',
      tag: 'SIRE-1',
    });

    const calf = await createAnimal({
      farm_id: farmA,
      species: 'cattle',
      sex: 'female',
      tag: 'CALF-1',
      sire_id: sire.id,
      dam_id: dam.id,
      birth_date: '2025-01-15',
    });
    expect(calf.tag).toBe('CALF-1');

    // A female cannot be a sire.
    const wrongSire = await createAnimal(
      {
        farm_id: farmA,
        species: 'cattle',
        sex: 'male',
        tag: 'X-1',
        sire_id: dam.id,
      },
      422,
    );
    expect(fields(wrongSire)).toEqual(['sire_id']);
  });

  it('lists with filters, isolates per org, and reports herd stats', async () => {
    const goat = await createAnimal({
      farm_id: farmA,
      species: 'goat',
      sex: 'male',
      tag: 'G-001',
      breed_id: goatBreed,
    });

    const all = await agentA.get('/api/v1/animals').expect(200);
    expect((all.body as AnimalList).total).toBe(5);

    const goats = await agentA.get('/api/v1/animals?species=goat').expect(200);
    expect((goats.body as AnimalList).total).toBe(1);
    expect((goats.body as AnimalList).data[0].tag).toBe('G-001');

    const females = await agentA
      .get(`/api/v1/animals?sex=female&farm_id=${farmA}`)
      .expect(200);
    expect((females.body as AnimalList).total).toBe(3);

    // Tenant isolation: org B sees nothing and cannot read A's animal.
    const foreign = await agentB.get('/api/v1/animals').expect(200);
    expect((foreign.body as AnimalList).total).toBe(0);
    await agentB.get(`/api/v1/animals/${goat.id}`).expect(404);

    const stats = await agentA.get('/api/v1/animals/stats').expect(200);
    const herd = stats.body as HerdStats;
    expect(herd.total).toBe(5);
    expect(herd.by_species).toEqual({ cattle: 4, goat: 1 });
    expect(herd.by_status).toEqual({ active: 5 });
  });

  it('updates status and tag through the lifecycle', async () => {
    const list = await agentA.get('/api/v1/animals?species=goat').expect(200);
    const goat = (list.body as AnimalList).data[0];

    const sold = await agentA
      .patch(`/api/v1/animals/${goat.id}`)
      .set('X-CSRF-Token', csrfA)
      .send({ status: 'sold', tag: 'G-001-B' })
      .expect(200);
    expect((sold.body as AnimalDetail).status).toBe('sold');
    expect((sold.body as AnimalDetail).tag).toBe('G-001-B');

    // The old tag is free again.
    await createAnimal({
      farm_id: farmA,
      species: 'goat',
      sex: 'female',
      tag: 'G-001',
    });
  });

  it('soft-deletes an animal created in error and frees its tag', async () => {
    const mistake = await createAnimal({
      farm_id: farmA,
      species: 'pig',
      sex: 'male',
      tag: 'TYPO-9',
    });

    await agentA
      .delete(`/api/v1/animals/${mistake.id}`)
      .set('X-CSRF-Token', csrfA)
      .expect(204);
    await agentA.get(`/api/v1/animals/${mistake.id}`).expect(404);

    // Tag reusable after the erroneous record is gone.
    await createAnimal({
      farm_id: farmA,
      species: 'pig',
      sex: 'male',
      tag: 'TYPO-9',
    });
  });
});
