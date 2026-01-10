import { Module, Scope } from '@nestjs/common';
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
import { AdminRideController } from './controllers/admin-ride.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    // Guards
    AdminRoleGuard,

    // Services (Request-scoped for TenantScopedService)
    {
      provide: AdminDriverService,
      useClass: AdminDriverService,
      scope: Scope.REQUEST,
    },
    {
      provide: AdminInvitationService,
      useClass: AdminInvitationService,
      scope: Scope.REQUEST,
    },
    {
      provide: AdminRideService,
      useClass: AdminRideService,
      scope: Scope.REQUEST,
    },
    {
      provide: AdminPaymentService,
      useClass: AdminPaymentService,
      scope: Scope.REQUEST,
    },
    {
      provide: AdminReportService,
      useClass: AdminReportService,
      scope: Scope.REQUEST,
    },
    {
      provide: AdminProfileService,
      useClass: AdminProfileService,
      scope: Scope.REQUEST,
    },
  ],
  controllers: [
    AdminDriverController,
    AdminInvitationController,
    AdminPaymentController,
    AdminReportController,
    AdminProfileController,
    AdminRideController,
  ],
  exports: [
    // Export services if needed by other modules
    AdminDriverService,
    AdminInvitationService,
    AdminRideService,
    AdminPaymentService,
    AdminReportService,
    AdminProfileService,
  ],
})
export class AdminModule {}
