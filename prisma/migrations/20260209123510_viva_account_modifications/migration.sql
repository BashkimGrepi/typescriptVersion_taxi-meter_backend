/*
  Warnings:

  - Added the required column `provider` to the `VivaAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."VivaAccount" ADD COLUMN     "provider" "public"."PaymentProvider" NOT NULL;
