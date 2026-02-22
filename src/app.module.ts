import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DriversModule } from './drivers/drivers.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './drivers/payments/payments-module';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { ExportsModule } from './admin/exports/exports.module';
import { PricingPoliciesModule } from './pricings/pricing-policies.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { VivaWebhookModule } from './viva-webhook/viva-webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 43200, // 12 hours in seconds
    }),
    AuthModule,
    DriversModule,
    PrismaModule,
    HealthModule,
    PaymentsModule,
    AdminModule,
    ExportsModule,
    PricingPoliciesModule,
    VivaWebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
