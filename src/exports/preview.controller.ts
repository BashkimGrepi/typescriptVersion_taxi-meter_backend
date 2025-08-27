import { BadRequestException, Controller, Get, Header, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SnapshotService } from './snapshot.service';
import { PdfService } from './pdf/pdf.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/exports')
export class ExportsPreviewController {
  constructor(
    private readonly snapshot: SnapshotService,
    private readonly pdf: PdfService,
  ) {}

  @Get('payments.preview')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="payments-preview.pdf"')
  async preview(@Req() req, @Res() res, @Query('from') fromStr: string, @Query('to') toStr: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new BadRequestException('Missing tenant');
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to) {
      throw new BadRequestException('Invalid date range');
    }

    // Build snapshot (this will also assign numbers idempotently)
    const { snapshot, sha256 } = await this.snapshot.buildSnapshot({
      tenantId,
      from, to,
      type: 'simplified',
      generatedBy: { userId: req.user.sub, email: req.user.email },
      includeAnnex: false,
    });
    // Attach hash into snapshot for the template to display
    (snapshot as any).sha256 = sha256;

    const pdf = await this.pdf.renderPaymentsPdf(snapshot);
    res.end(pdf);
  }
}
