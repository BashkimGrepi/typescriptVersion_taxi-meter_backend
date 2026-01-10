import { Module, Scope } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingPoliciesModule {}
