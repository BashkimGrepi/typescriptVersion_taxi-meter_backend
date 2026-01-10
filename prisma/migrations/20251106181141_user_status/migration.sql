/*
  Warnings:

  - Changed the type of `status` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'OFFLINE');

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "status",
ADD COLUMN     "status" "public"."UserStatus" NOT NULL;
