import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('Silvervibe API')
    .setDescription('HTTP API for Silvervibe apps and product add-ons.')
    .setVersion('1.0')
    .addTag('health')
    .addTag('auth')
    .addTag('workspaces')
    .addTag('flags')
    .addTag('slack')
    .addTag('teams')
    .addTag('jira')
    .addTag('linear')
    .addTag('github')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Firebase ID token. Outside production, when Admin is unset: Bearer dev:<uid>.',
      },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  return document;
}
