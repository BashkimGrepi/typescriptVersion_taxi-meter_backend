import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Use process signals instead of Prisma's beforeExit
    process.on('SIGINT', async () => {
      await this.$disconnect();
      await app.close();
    });
    
    process.on('SIGTERM', async () => {
      await this.$disconnect();
      await app.close();
    });
  }
}
