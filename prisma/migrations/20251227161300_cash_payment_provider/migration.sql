/*
  Warnings:

  - The values [STRIPE] on the enum `PaymentProvider` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."PaymentProvider_new" AS ENUM ('CASH', 'VIVA');
ALTER TABLE "public"."Payment" ALTER COLUMN "provider" TYPE "public"."PaymentProvider_new" USING ("provider"::text::"public"."PaymentProvider_new");
ALTER TABLE "public"."PaymentLink" ALTER COLUMN "provider" TYPE "public"."PaymentProvider_new" USING ("provider"::text::"public"."PaymentProvider_new");
ALTER TABLE "public"."ProviderAccount" ALTER COLUMN "provider" TYPE "public"."PaymentProvider_new" USING ("provider"::text::"public"."PaymentProvider_new");
ALTER TABLE "public"."WebhookEvent" ALTER COLUMN "provider" TYPE "public"."PaymentProvider_new" USING ("provider"::text::"public"."PaymentProvider_new");
ALTER TABLE "public"."OAuthState" ALTER COLUMN "provider" TYPE "public"."PaymentProvider_new" USING ("provider"::text::"public"."PaymentProvider_new");
ALTER TYPE "public"."PaymentProvider" RENAME TO "PaymentProvider_old";
ALTER TYPE "public"."PaymentProvider_new" RENAME TO "PaymentProvider";
DROP TYPE "public"."PaymentProvider_old";
COMMIT;
