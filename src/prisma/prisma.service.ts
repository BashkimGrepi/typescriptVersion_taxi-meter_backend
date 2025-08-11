import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('DATABASE_URL'),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    // Handle Node.js process signals
    process.on('SIGINT', async () => {
      await this.handleShutdown(app);
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.handleShutdown(app);
      process.exit(0);
    });

    // Handle NestJS application shutdown
    app.enableShutdownHooks();
  }

  private async handleShutdown(app: INestApplication) {
    try {
      console.log('Disconnecting from database...');
      await this.$disconnect();
      console.log('Database disconnected');
      
      console.log('Closing application...');
      await app.close();
      console.log('Application closed');
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }
}