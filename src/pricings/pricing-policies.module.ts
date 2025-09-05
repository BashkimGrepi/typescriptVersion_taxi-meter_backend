import { Module } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  controllers: [PricingController],
  providers: [PricingService, PrismaService],
  exports: [PricingService],
})
export class PricingPoliciesModule {}
