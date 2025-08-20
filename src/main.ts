import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { JwtGlobalGuard } from './auth/guards/jwt-global.guard';
import { Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Taxi Meter API')
    .setDescription('API for taxi meter multi-tenant application with Stripe Connect integration')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  // Get PrismaService instance and enable shutdown hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtGlobalGuard(reflector)); // applies JWT protection to entire application

  await app.listen(process.env.PORT ?? 3000);
  
  Logger.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
  Logger.log(`Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
