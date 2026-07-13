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

interface ImportResponse {
  job: { id: string; status: string; dry_run: boolean; total_rows: number };
  summary: {
    total: number;
    valid?: number;
    imported?: number;
    skipped: number;
    errors: number;
  };
  results: {
    row_number: number;
    status: string;
    message: string | null;
    animal_id: string | null;
  }[];
}

describe('CSV import (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const organizationIds: string[] = [];
  let agentA: TestAgent;
  let csrfA: string;
  let agentB: TestAgent;

  // Spanish-Excel-style file: semicolons, DD/MM/YYYY, comma decimals.
  // Rows: 2 valid, 1 unknown species, 1 missing tag, 1 future birth date,
  // 1 duplicate tag within the file.
  const csvContent = [
    'tag;species;sex;farm;breed;birth_date;tenure;weight_kg;weight_date',
    'V-001;bovino;hembra;El Ñandú;Brahman;15/03/2022;propio;350,5;01/06/2026',
    'V-002;cattle;male;El Ñandú;;;owned;;',
    'V-003;dragon;female;El Ñandú;;;;;',
    ';cattle;female;El Ñandú;;;;;',
    'V-004;cattle;female;El Ñandú;;01/01/2030;;;',
    'V-001;cattle;female;El Ñandú;;;;;',
  ].join('\r\n');

  function upload(
    agent: TestAgent,
    csrf: string,
    body: Buffer,
    dryRun: boolean,
  ) {
    return agent
      .post(`/api/v1/imports/animals?dry_run=${dryRun}`)
      .set('X-CSRF-Token', csrf)
      .attach('file', body, 'herd.csv');
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    organizationIds.push(await createOrgWithOwner(prisma, 'imports-A'));
    organizationIds.push(await createOrgWithOwner(prisma, 'imports-B'));
    ({ agent: agentA, csrf: csrfA } = await loginAgent(
      app,
      prisma,
      organizationIds[0],
    ));
    ({ agent: agentB } = await loginAgent(app, prisma, organizationIds[1]));

    await prisma.farms.create({
      data: { organization_id: organizationIds[0], name: 'El Ñandú' },
    });
    await prisma.breeds.create({
      data: {
        organization_id: organizationIds[0],
        species: 'cattle',
        name: 'Brahman',
      },
    });
  });

  afterAll(async () => {
    const inOrgs = { organization_id: { in: organizationIds } };
    await prisma.weight_records.deleteMany({
      where: { animals: inOrgs },
    });
    await prisma.import_row_results.deleteMany({
      where: { import_jobs: inOrgs },
    });
    await prisma.animal_identifiers.deleteMany({ where: inOrgs });
    await prisma.animals.deleteMany({ where: inOrgs });
    await prisma.import_jobs.deleteMany({ where: inOrgs });
    await cleanupOrgs(prisma, organizationIds);
    await app.close();
  });

  it('serves the CSV template', async () => {
    const response = await agentA
      .get('/api/v1/imports/animals/template')
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(response.text).toContain('tag;species;sex;farm');
  });

  it('dry run validates every row and writes nothing', async () => {
    // latin1 encoding, as a Spanish Windows Excel would produce ("Ñandú").
    const body = Buffer.from(csvContent, 'latin1');
    const response = await upload(agentA, csrfA, body, true).expect(201);
    const result = response.body as ImportResponse;

    expect(result.job.status).toBe('completed');
    expect(result.summary).toEqual({
      total: 6,
      valid: 2,
      skipped: 0,
      errors: 4,
    });
    const byRow = Object.fromEntries(
      result.results.map((row) => [row.row_number, row]),
    );
    expect(byRow[2].status).toBe('valid');
    expect(byRow[3].status).toBe('valid');
    expect(byRow[4].message).toContain('Unknown species');
    expect(byRow[5].message).toContain('Tag is required');
    expect(byRow[6].message).toContain('future');
    expect(byRow[7].message).toContain('Duplicate tag');

    // Nothing was written.
    const count = await prisma.animals.count({
      where: { organization_id: organizationIds[0] },
    });
    expect(count).toBe(0);
  });

  it('commit imports valid rows and re-uploading skips them (idempotent)', async () => {
    const body = Buffer.from(csvContent, 'latin1');
    const first = await upload(agentA, csrfA, body, false).expect(201);
    const firstResult = first.body as ImportResponse;
    expect(firstResult.summary).toEqual({
      total: 6,
      imported: 2,
      skipped: 0,
      errors: 4,
    });

    // The full row landed: animal + tag + initial weight, linked to the job.
    const imported = firstResult.results.find((row) => row.row_number === 2)!;
    const animal = await prisma.animals.findUnique({
      where: { id: imported.animal_id! },
      include: { animal_identifiers: true, weight_records: true },
    });
    expect(animal!.species).toBe('cattle');
    expect(animal!.sex).toBe('female');
    expect(animal!.tenure).toBe('owned');
    expect(animal!.birth_date?.toISOString()).toContain('2022-03-15');
    expect(animal!.import_job_id).toBe(firstResult.job.id);
    expect(animal!.animal_identifiers[0].value).toBe('V-001');
    expect(Number(animal!.weight_records[0].weight_kg)).toBe(350.5);

    // Re-uploading the same file never duplicates.
    const second = await upload(agentA, csrfA, body, false).expect(201);
    expect((second.body as ImportResponse).summary).toEqual({
      total: 6,
      imported: 0,
      skipped: 2,
      errors: 4,
    });
    const count = await prisma.animals.count({
      where: { organization_id: organizationIds[0] },
    });
    expect(count).toBe(2);
  });

  it('downloads the per-row report and lists jobs', async () => {
    const jobs = await agentA.get('/api/v1/imports').expect(200);
    const jobList = (jobs.body as { data: { id: string }[]; total: number })
      .data;
    expect(jobList.length).toBeGreaterThanOrEqual(3);

    const report = await agentA
      .get(`/api/v1/imports/${jobList[0].id}/report`)
      .expect(200)
      .expect('Content-Type', /text\/csv/);
    expect(report.text).toContain('row_number;status;message');
    expect(report.text).toContain('skipped');

    // Jobs are org-scoped.
    await agentB.get(`/api/v1/imports/${jobList[0].id}`).expect(404);
  });

  it('rejects a file without the required columns', async () => {
    const body = Buffer.from('nombre;raza\nLola;Brahman\n', 'utf8');
    const response = await upload(agentA, csrfA, body, true).expect(422);
    expect(JSON.stringify(response.body)).toContain('Missing required columns');
  });
});
