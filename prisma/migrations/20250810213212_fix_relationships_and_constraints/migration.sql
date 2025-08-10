/*
  Warnings:

  - The values [REQUESTED] on the enum `RideStatus` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `Ride` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `distanceM` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `driverId` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `durationS` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `fareCents` on the `Ride` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Ride` table. All the data in the column will be lost.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Driver` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Entrepreneur` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `driverProfileId` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startedAt` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passwordHash` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('STRIPE', 'VIVA');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('REQUIRES_ACTION', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterEnum
BEGIN;
CREATE TYPE "public"."RideStatus_new" AS ENUM ('DRAFT', 'ONGOING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."Ride" ALTER COLUMN "status" TYPE "public"."RideStatus_new" USING ("status"::text::"public"."RideStatus_new");
ALTER TYPE "public"."RideStatus" RENAME TO "RideStatus_old";
ALTER TYPE "public"."RideStatus_new" RENAME TO "RideStatus";
DROP TYPE "public"."RideStatus_old";
COMMIT;

-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'MANAGER';

-- DropForeignKey
ALTER TABLE "public"."Driver" DROP CONSTRAINT "Driver_entrepreneurId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Driver" DROP CONSTRAINT "Driver_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Entrepreneur" DROP CONSTRAINT "Entrepreneur_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Ride" DROP CONSTRAINT "Ride_driverId_fkey";

-- AlterTable
ALTER TABLE "public"."Ride" DROP CONSTRAINT "Ride_pkey",
DROP COLUMN "distanceM",
DROP COLUMN "driverId",
DROP COLUMN "durationS",
DROP COLUMN "endTime",
DROP COLUMN "fareCents",
DROP COLUMN "startTime",
ADD COLUMN     "distanceKm" DECIMAL(10,3),
ADD COLUMN     "driverProfileId" TEXT NOT NULL,
ADD COLUMN     "durationMin" DECIMAL(10,2),
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "fareSubtotal" DECIMAL(10,2),
ADD COLUMN     "fareTotal" DECIMAL(10,2),
ADD COLUMN     "pricingPolicyId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "taxAmount" DECIMAL(10,2),
ADD COLUMN     "tenantId" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Ride_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Ride_id_seq";

-- AlterTable
ALTER TABLE "public"."User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "password",
DROP COLUMN "role",
ADD COLUMN     "passwordHash" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "username" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "User_id_seq";

-- DropTable
DROP TABLE "public"."Driver";

-- DropTable
DROP TABLE "public"."Entrepreneur";

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT,
    "driverProfileId" TEXT,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PricingPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseFare" DECIMAL(10,2) NOT NULL,
    "perMinute" DECIMAL(10,4) NOT NULL,
    "perKm" DECIMAL(10,4) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PricingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."PaymentStatus" NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "externalPaymentId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentLink" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "PaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProviderAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "scope" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3),
    "metadataJson" JSONB,

    CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadJson" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tenant_businessId_idx" ON "public"."Tenant"("businessId");

-- CreateIndex
CREATE INDEX "Membership_tenantId_role_idx" ON "public"."Membership"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "public"."Membership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "public"."Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "public"."DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "DriverProfile_tenantId_idx" ON "public"."DriverProfile"("tenantId");

-- CreateIndex
CREATE INDEX "DriverProfile_userId_idx" ON "public"."DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "PricingPolicy_tenantId_isActive_idx" ON "public"."PricingPolicy"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "PricingPolicy_tenantId_validFrom_validTo_idx" ON "public"."PricingPolicy"("tenantId", "validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "PricingPolicy_tenantId_isActive_key" ON "public"."PricingPolicy"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_rideId_key" ON "public"."Payment"("rideId");

-- CreateIndex
CREATE INDEX "Payment_tenantId_status_idx" ON "public"."Payment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentLink_rideId_status_idx" ON "public"."PaymentLink"("rideId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderAccount_tenantId_provider_key" ON "public"."ProviderAccount"("tenantId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalId_key" ON "public"."WebhookEvent"("externalId");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_eventType_idx" ON "public"."WebhookEvent"("provider", "eventType");

-- CreateIndex
CREATE INDEX "Ride_tenantId_status_idx" ON "public"."Ride"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Ride_driverProfileId_idx" ON "public"."Ride"("driverProfileId");

-- CreateIndex
CREATE INDEX "Ride_startedAt_idx" ON "public"."Ride"("startedAt");

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invitation" ADD CONSTRAINT "Invitation_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverProfile" ADD CONSTRAINT "DriverProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PricingPolicy" ADD CONSTRAINT "PricingPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "public"."DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ride" ADD CONSTRAINT "Ride_pricingPolicyId_fkey" FOREIGN KEY ("pricingPolicyId") REFERENCES "public"."PricingPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentLink" ADD CONSTRAINT "PaymentLink_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."Ride"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProviderAccount" ADD CONSTRAINT "ProviderAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
