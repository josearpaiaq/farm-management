import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Farm Management API')
    .setDescription('API for managing livestock farms')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // UI at /api/docs; raw OpenAPI document at /api/docs-json.
  SwaggerModule.setup('api/docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
