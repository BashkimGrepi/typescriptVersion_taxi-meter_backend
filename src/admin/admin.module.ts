import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

// Guards and decorators
import { AdminRoleGuard } from './guards/admin-role.guard';

// Services
import { AdminDriverService } from './services/admin-driver.service';
import { AdminInvitationService } from './services/admin-invitation.service';
import { AdminRideService } from './services/admin-ride.service';
import { AdminPaymentService } from './services/admin-payment.service';
import { AdminReportService } from './services/admin-report.service';
import { AdminProfileService } from './services/admin-profile.service';

// Controllers
import { AdminDriverController } from './controllers/admin-driver.controller';
import { AdminInvitationController } from './controllers/admin-invitation.controller';

import { AdminPaymentController } from './controllers/admin-payment.controller';
import { AdminReportController } from './controllers/admin-report.controller';
import { AdminProfileController } from './controllers/admin-profile.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    // Guards
    AdminRoleGuard,
    
    // Services
    AdminDriverService,
    AdminInvitationService,
    AdminRideService,
    AdminPaymentService,
    AdminReportService,
    AdminProfileService
  ],
  controllers: [
    AdminDriverController,
    AdminInvitationController,
    AdminPaymentController,
    AdminReportController,
    AdminProfileController
  ],
  exports: [
    // Export services if needed by other modules
    AdminDriverService,
    AdminInvitationService,
    AdminRideService,
    AdminPaymentService,
    AdminReportService,
    AdminProfileService
  ]
})
export class AdminModule {}
