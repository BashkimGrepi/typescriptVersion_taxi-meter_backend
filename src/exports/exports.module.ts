import { Module } from "@nestjs/common";
import { NumberingService } from "./numbering.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { ExportsTestController } from "./exportTest.controller";
import { PdfService } from "./pdf/pdf.service";
import { PrismaService } from "src/prisma/prisma.service";
import { SnapshotService } from "./snapshot.service";
import { ExportDataService } from "./export-data.service";
import { ExportsController } from "./exports.controller";


@Module({
  providers: [PrismaService, PdfService, SnapshotService, ExportDataService, NumberingService],
  controllers: [ExportsController],
  exports: [SnapshotService,PdfService],
})
export class ExportsModule {}