-- CreateIndex
CREATE INDEX "Payment_tenantId_status_capturedAt_idx" ON "public"."Payment"("tenantId", "status", "capturedAt");
