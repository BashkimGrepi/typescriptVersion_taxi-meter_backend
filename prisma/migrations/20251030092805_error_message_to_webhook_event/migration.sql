/*
  Warnings:

  - Added the required column `errorMessage` to the `WebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."WebhookEvent" ADD COLUMN     "errorMessage" TEXT NOT NULL;
