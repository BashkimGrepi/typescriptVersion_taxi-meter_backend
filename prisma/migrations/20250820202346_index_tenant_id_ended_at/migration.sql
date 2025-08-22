-- CreateIndex
CREATE INDEX "Ride_tenantId_endedAt_idx" ON "public"."Ride"("tenantId", "endedAt");
