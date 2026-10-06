import { mkdirSync, writeFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { setupSwagger } from './app/swagger';

async function generate() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = setupSwagger(app);
  mkdirSync('openapi', { recursive: true });
  writeFileSync(
    'openapi/silvervibe.openapi.json',
    JSON.stringify(document, null, 2),
  );
  await app.close();
}

void generate();
