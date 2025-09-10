/*
  Warnings:

  - You are about to drop the column `perMinute` on the `PricingPolicy` table. All the data in the column will be lost.
  - You are about to drop the column `validFrom` on the `PricingPolicy` table. All the data in the column will be lost.
  - You are about to drop the column `validTo` on the `PricingPolicy` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."PricingPolicy_tenantId_validFrom_validTo_idx";

-- AlterTable
ALTER TABLE "public"."PricingPolicy" DROP COLUMN "perMinute",
DROP COLUMN "validFrom",
DROP COLUMN "validTo",
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "PricingPolicy_tenantId_updatedAt_idx" ON "public"."PricingPolicy"("tenantId", "updatedAt");
