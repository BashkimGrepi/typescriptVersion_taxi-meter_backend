-- CreateEnum
CREATE TYPE "public"."RidePricingMode" AS ENUM ('METER', 'FIXED_PRICE', 'CUSTOM_FIXED');

-- AlterTable
ALTER TABLE "public"."Ride" ADD COLUMN     "customFixedFare" DECIMAL(10,2),
ADD COLUMN     "fixedPricePolicyId" TEXT,
ADD COLUMN     "pricingMode" "public"."RidePricingMode" NOT NULL DEFAULT 'METER';

-- CreateTable
CREATE TABLE "public"."FixedPricePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "driverProfileId" TEXT,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "FixedPricePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixedPricePolicy_tenantId_isActive_idx" ON "public"."FixedPricePolicy"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "FixedPricePolicy_tenantId_driverProfileId_idx" ON "public"."FixedPricePolicy"("tenantId", "driverProfileId");

-- AddForeignKey
ALTER TABLE "public"."FixedPricePolicy" ADD CONSTRAINT "FixedPricePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FixedPricePolicy" ADD CONSTRAINT "FixedPricePolicy_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_fixedPricePolicyId_fkey" FOREIGN KEY ("fixedPricePolicyId") REFERENCES "public"."FixedPricePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
