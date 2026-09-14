import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AdminProceduresService } from './admin-procedures/admin-procedures.service';
import { ContentService } from './content/content.service';

async function bootstrap() {
  // rawBody requis pour valider la signature des webhooks de paiement
  // (Bictorys / Stripe) sur le corps brut, avant tout parsing JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: '*' });

  const config = new DocumentBuilder()
    .setTitle('Bag\'up API')
    .setDescription('API de livraison & services Bag\'up')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application running on port ${process.env.PORT ?? 3000}`);

  const proceduresService = app.get(AdminProceduresService);
  await proceduresService.seed();
  console.log('Admin procedures seeded');

  const contentService = app.get(ContentService);
  await contentService.seedDefaults();
  console.log('Content defaults seeded');
}
bootstrap();
