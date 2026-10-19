import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { setupSwagger } from './app/swagger';

async function loadLocalEnv(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    return;
  }
  try {
    const { config } = await import('dotenv');
    config();
  } catch {
    // dotenv is a local/devDependency; Cloud Run injects env vars directly.
  }
}

async function bootstrap() {
  await loadLocalEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const origins = (
    process.env['CORS_ORIGINS'] ?? 'http://localhost:4200,http://localhost:4201'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins });
  setupSwagger(app);
  // Cloud Run sets PORT. Locally use API_PORT — root `.env` PORT is picked up by
  // Vite and would force Angular `nx serve` onto 3000 as well.
  const port = Number(process.env['PORT'] || process.env['API_PORT'] || 3000);
  const host = process.env['HOST'] || '0.0.0.0';
  await app.listen(port, host);
  Logger.log(`Silvervibe API: http://${host}:${port}/api/docs`);
}

void bootstrap();
