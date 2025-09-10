-- DropIndex
-- Drop the old unique (if it existed from @@unique([tenantId, isActive]))
DROP INDEX IF EXISTS "PricingPolicy_tenantId_isActive_key";

-- Allow many INACTIVE policies but only ONE ACTIVE per tenant
CREATE UNIQUE INDEX "uniq_active_pricing_policy_per_tenant"
  ON "PricingPolicy"("tenantId")
  WHERE "isActive" = true;
