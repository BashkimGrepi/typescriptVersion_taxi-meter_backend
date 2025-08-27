import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SnapshotService } from './snapshot.service';
import { PdfService } from './pdf/pdf.service';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

function safeTs(d = new Date()) {
  // compact timestamp for filenames, e.g. 2025-08-26T13:42:10Z -> 20250826-134210
  const iso = d.toISOString();
  return iso.slice(0,10).replace(/-/g,'') + '-' + iso.slice(11,19).replace(/:/g,'');
}

@UseGuards(JwtAuthGuard)
@Controller('admin/exports')
export class ExportsController {
  constructor(
    private readonly snapshot: SnapshotService,
    private readonly pdf: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('payments.pdf')
  @Header('Content-Type', 'application/pdf')
  async download(
    @Req() req,
    @Res() res,
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Query('type') type = 'simplified',
    @Query('annex') annex = '0',
  ) {
    // ---- 0) Auth & params ---------------------------------------------------
    const role = req.user?.role;
    if (!['ADMIN', 'MANAGER'].includes(role)) {
      throw new ForbiddenException('Admins/Managers only');
    }
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Missing tenant context');

    if (type !== 'simplified') {
      throw new BadRequestException('Only type=simplified is supported in v1');
    }

    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to) {
      throw new BadRequestException('Invalid date range');
    }

    // ---- 1) Build snapshot (idempotently assigns receipt numbers) -----------
    const { snapshot, sha256 } = await this.snapshot.buildSnapshot({
      tenantId,
      from,
      to,
      type: 'simplified',
      generatedBy: { userId: req.user.sub, email: req.user.email },
      includeAnnex: annex === '1',
    });
    // The template prints the hash; attach for rendering convenience.
    (snapshot as any).sha256 = sha256;

    // ---- 2) Render PDF from the snapshot -----------------------------------
    const pdfBuffer = await this.pdf.renderPaymentsPdf(snapshot);

    // ---- 3) Persist files (PDF + JSON) -------------------------------------
    // Root path can be env-configured; default to ./exports relative to project
    const ROOT = process.env.EXPORTS_ROOT ?? path.join(process.cwd(), 'exports');
    const period = snapshot?.meta?.period?.yyyymm as string; // 'YYYYMM'
    if (!period) throw new BadRequestException('Snapshot missing period');

    const typeFolder = 'simplified';
    const dir = path.join(ROOT, tenantId, period, typeFolder);
    await fs.mkdir(dir, { recursive: true });

    const ts = safeTs(); // for unique names
    const baseName = `payments-${period}-${ts}`;
    const jsonPath = path.join(dir, `${baseName}.json`);
    const pdfPath  = path.join(dir, `${baseName}.pdf`);

    // Persist the exact JSON we used (integrity/readability for ≥6 years)
    const jsonString = JSON.stringify(snapshot, null, 2);
    await fs.writeFile(jsonPath, jsonString, 'utf8');
    await fs.writeFile(pdfPath, pdfBuffer);

    // ---- 4) Archive row (for listing/retention) -----------------------------
    // quick roll-ups from snapshot for the archive table
    const count = Array.isArray(snapshot?.payments) ? snapshot.payments.length : 0;
    const totalAmount = (snapshot?.payments ?? []).reduce(
      (acc: Prisma.Decimal, p: any) => acc.add(new Prisma.Decimal(p.total ?? '0')),
      new Prisma.Decimal(0),
    ).toDP(2).toString();

    await this.prisma.exportArchive.create({
      data: {
        tenantId,
        period,                     // 'YYYYMM'
        type: 'simplified',
        createdByUserId: req.user.sub,
        pdfPath,                    // store full path or a relative one; be consistent
        jsonPath,
        sha256,                     // snapshot hash printed on the cover
        count,
        totalAmount,                // string 'xx.yy'
      } as any,
    });

    // ---- 5) Stream PDF to client -------------------------------------------
    const downloadName = `payments-${period}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.end(pdfBuffer);
  }
}
