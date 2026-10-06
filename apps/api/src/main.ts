import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { AppModule } from './app/app.module';
import { setupSwagger } from './app/swagger';

loadEnv();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = (process.env['CORS_ORIGINS'] ??
    'http://localhost:4200,http://localhost:4201')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: origins });
  setupSwagger(app);
  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  Logger.log(`Silvervibe API: http://localhost:${port}/api/docs`);
}

void bootstrap();
