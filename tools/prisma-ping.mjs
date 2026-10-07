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

  // Smoke-check core tables from the foundation migration (issue #4).
  const [users, workspaces, members, tools, addons] = await Promise.all([
    prisma.user.count(),
    prisma.workspace.count(),
    prisma.workspaceMember.count(),
    prisma.workspaceTool.count(),
    prisma.addonConnection.count(),
  ]);

  console.log(
    `Core schema OK. counts: users=${users} workspaces=${workspaces} members=${members} tools=${tools} addons=${addons}`,
  );
} catch (error) {
  console.error('Prisma connection / schema check failed:', error);
  console.error(
    'If tables are missing, run npm run prisma:migrate (local) or npm run prisma:migrate:deploy.',
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
