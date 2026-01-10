import { Module, Scope } from '@nestjs/common';
import { NumberingService } from './numbering.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ExportsTestController } from './exportTest.controller';
import { PdfService } from './pdf/pdf.service';
import { SnapshotService } from './snapshot.service';
import { ExportDataService } from './export-data.service';
import { ExportsController } from './exports.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    PdfService,
    {
      provide: SnapshotService,
      useClass: SnapshotService,
      scope: Scope.REQUEST,
    },
    {
      provide: ExportDataService,
      useClass: ExportDataService,
      scope: Scope.REQUEST,
    },
    {
      provide: NumberingService,
      useClass: NumberingService,
      scope: Scope.REQUEST,
    },
  ],
  controllers: [ExportsController],
  exports: [SnapshotService, PdfService],
})
export class ExportsModule {}
