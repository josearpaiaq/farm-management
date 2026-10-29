// Marks a user's email as verified without the emailed code. Stopgap for
// environments where outbound email (Resend) is not configured yet.
// Run with: pnpm verify-user <email>
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Expand ${VAR} references so DATABASE_URL can be built from POSTGRES_*.
expand(config());

async function main(): Promise<void> {
  const email = (process.argv[2] ?? '').toLowerCase();
  if (!email) {
    throw new Error('Usage: pnpm verify-user <email>');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const { count } = await prisma.users.updateMany({
      where: { email, email_verified_at: null },
      data: { email_verified_at: new Date() },
    });
    if (count === 1) {
      console.log(`Verified ${email}.`);
    } else {
      const exists = await prisma.users.findFirst({ where: { email } });
      console.log(
        exists ? `${email} was already verified.` : `No user with ${email}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
