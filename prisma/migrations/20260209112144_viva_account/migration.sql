-- CreateTable
CREATE TABLE "public"."VivaAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VivaAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VivaAccount_tenantId_key" ON "public"."VivaAccount"("tenantId");

-- CreateIndex
CREATE INDEX "VivaAccount_tenantId_merchantId_idx" ON "public"."VivaAccount"("tenantId", "merchantId");

-- AddForeignKey
ALTER TABLE "public"."VivaAccount" ADD CONSTRAINT "VivaAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
