/*
  Warnings:

  - A unique constraint covering the columns `[rideId]` on the table `Receipt` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Receipt_rideId_key" ON "public"."Receipt"("rideId");
