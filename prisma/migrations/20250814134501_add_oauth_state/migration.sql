-- CreateTable
CREATE TABLE "public"."OAuthState" (
    "id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_nonce_key" ON "public"."OAuthState"("nonce");

-- CreateIndex
CREATE INDEX "OAuthState_nonce_idx" ON "public"."OAuthState"("nonce");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "public"."OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthState_tenantId_provider_idx" ON "public"."OAuthState"("tenantId", "provider");

-- AddForeignKey
ALTER TABLE "public"."OAuthState" ADD CONSTRAINT "OAuthState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
