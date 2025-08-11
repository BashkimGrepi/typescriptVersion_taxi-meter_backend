-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateEnum
CREATE TYPE "public"."PaymentProviderStatus" AS ENUM ('CONNECTED', 'PENDING', 'DISCONNECTED');
