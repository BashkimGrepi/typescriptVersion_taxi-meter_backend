-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "netAmount" DECIMAL(10,2),
ADD COLUMN     "taxAmount" DECIMAL(10,2);

-- CreateIndex
CREATE INDEX "Invitation_tenantId_idx" ON "public"."Invitation"("tenantId");

-- CreateIndex
CREATE INDEX "Receipt_tenantId_idx" ON "public"."Receipt"("tenantId");

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NumberSequence" ADD CONSTRAINT "NumberSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExportArchive" ADD CONSTRAINT "ExportArchive_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
