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

// Controllers
import { AdminDriverController } from './controllers/admin-driver.controller';
import { AdminInvitationController } from './controllers/admin-invitation.controller';
import { AdminRideController } from './controllers/admin-ride.controller';
import { AdminPaymentController } from './controllers/admin-payment.controller';
import { AdminReportController } from './controllers/admin-report.controller';

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
    AdminReportService
  ],
  controllers: [
    AdminDriverController,
    AdminInvitationController,
    AdminRideController,
    AdminPaymentController,
    AdminReportController
  ],
  exports: [
    // Export services if needed by other modules
    AdminDriverService,
    AdminInvitationService,
    AdminRideService,
    AdminPaymentService,
    AdminReportService
  ]
})
export class AdminModule {}
