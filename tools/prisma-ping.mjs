import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv();

const url = process.env.DATABASE_URL;

if (!url || url.includes('USER:PASSWORD@HOST')) {
  console.error(
    'DATABASE_URL is missing or still a placeholder. Copy your Neon pooled URI into .env — see docs/neon.md',
  );
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  await prisma.$queryRawUnsafe('SELECT 1 AS ok');
  console.log('Prisma connected to DATABASE_URL successfully.');
} catch (error) {
  console.error('Prisma connection failed:', error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
