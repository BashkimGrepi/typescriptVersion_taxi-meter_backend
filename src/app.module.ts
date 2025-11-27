import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DriversModule } from './drivers/drivers.module';
import { RidesModule } from './rides/rides.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentsModule } from './payments/payments-module';
import { ReportsModule } from './reports/reports.module';
import { TenantsModule } from './tenants/tenants.module';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { ExportsModule } from './exports/exports.module';
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
    UsersModule,
    DriversModule,
    RidesModule,
    PrismaModule,
    HealthModule,
    PaymentsModule,
    ReportsModule,
    TenantsModule,
    AdminModule,
    ExportsModule,
    PricingPoliciesModule,
    VivaWebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
