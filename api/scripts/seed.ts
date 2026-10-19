// Seeds the initial organization and owner user from SEED_* env vars.
// Idempotent: if the owner email already exists, it does nothing.
// Run with: pnpm seed
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';

// Expand ${VAR} references so DATABASE_URL can be built from POSTGRES_*.
expand(config());

async function main(): Promise<void> {
  const email = (process.env.SEED_OWNER_EMAIL ?? '').toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const orgName = process.env.SEED_ORG_NAME ?? 'My Farm';
  const fullName = process.env.SEED_OWNER_NAME ?? 'Owner';

  if (!email || !password) {
    throw new Error('SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD are required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const existing = await prisma.users.findFirst({ where: { email } });
    if (existing) {
      console.log(`Owner ${email} already exists; nothing to do.`);
      return;
    }

    const organization = await prisma.organizations.create({
      data: { name: orgName },
    });
    await prisma.users.create({
      data: {
        organization_id: organization.id,
        role_id: 1, // owner (seeded in db/schema.sql)
        email,
        password_hash: await argon2.hash(password, { type: argon2.argon2id }),
        full_name: fullName,
      },
    });
    console.log(`Seeded organization "${orgName}" with owner ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
