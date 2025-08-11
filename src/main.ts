import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { JwtGlobalGuard } from './auth/guards/jwt-global.guard';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Get PrismaService instance and enable shutdown hooks
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const reflector = app.get(Reflector);
  app.useGlobalGuards(new JwtGlobalGuard(reflector));

  await app.listen(process.env.PORT ?? 3000);
  
  Logger.log(`Application is running on: http://localhost:${process.env.PORT ?? 3000}`);
}
bootstrap();
