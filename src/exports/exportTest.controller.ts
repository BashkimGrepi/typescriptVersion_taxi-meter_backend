import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { NumberingService } from './numbering.service';

@UseGuards(JwtAuthGuard) // WHY: enforce login; we also want tenantId from token
@Controller('admin/exports')
export class ExportsTestController {
  constructor(private readonly numbering: NumberingService) {}

  @Get('numbering') // GET /admin/exports/numbering?from=YYYY-MM-01&to=YYYY-MM-01
  async assign(@Req() req, @Query('from') fromStr: string, @Query('to') toStr: string) {
    // WHY: only office users should touch numbering
    if (!['ADMIN', 'MANAGER'].includes(req.user?.role)) {
      throw new ForbiddenException('Admins/Managers only');
    }
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Missing tenant context');

    // Basic date validation
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to) {
      throw new BadRequestException('Invalid date range');
    }

    // WHY: this mutates DB (assigns numbers). Perfect for verifying idempotency.
    return this.numbering.assignSimplifiedReceiptNumbers(tenantId, from, to);
  }
}
