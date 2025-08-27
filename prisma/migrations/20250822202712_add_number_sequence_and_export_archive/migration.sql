/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,numberPeriod,receiptNumber]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,numberPeriod,invoiceNumber]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."NumberSequenceType" AS ENUM ('RECEIPT', 'INVOICE');

-- CreateEnum
CREATE TYPE "public"."ExportArchiveType" AS ENUM ('simplified', 'full');

-- AlterTable
ALTER TABLE "public"."Payment" ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "numberPeriod" TEXT,
ADD COLUMN     "receiptNumber" TEXT;

-- CreateTable
CREATE TABLE "public"."NumberSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "public"."NumberSequenceType" NOT NULL,
    "period" TEXT NOT NULL,
    "current" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExportArchive" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" "public"."ExportArchiveType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "jsonPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExportArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NumberSequence_tenantId_type_period_key" ON "public"."NumberSequence"("tenantId", "type", "period");

-- CreateIndex
CREATE INDEX "ExportArchive_tenantId_period_type_idx" ON "public"."ExportArchive"("tenantId", "period", "type");

-- CreateIndex
CREATE INDEX "Payment_tenantId_capturedAt_idx" ON "public"."Payment"("tenantId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_numberPeriod_receiptNumber_key" ON "public"."Payment"("tenantId", "numberPeriod", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_numberPeriod_invoiceNumber_key" ON "public"."Payment"("tenantId", "numberPeriod", "invoiceNumber");
