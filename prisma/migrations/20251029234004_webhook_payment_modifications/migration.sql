-- AlterTable
ALTER TABLE "public"."WebhookEvent" ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "rideId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_externalPaymentId_idx" ON "public"."Payment"("externalPaymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentId_idx" ON "public"."WebhookEvent"("paymentId");

-- CreateIndex
CREATE INDEX "WebhookEvent_rideId_idx" ON "public"."WebhookEvent"("rideId");

-- CreateIndex
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "public"."WebhookEvent"("receivedAt");

-- AddForeignKey
ALTER TABLE "public"."WebhookEvent" ADD CONSTRAINT "WebhookEvent_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
