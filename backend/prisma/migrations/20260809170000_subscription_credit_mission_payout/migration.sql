-- AlterEnum
CREATE TYPE "MissionPayoutStatus" AS ENUM ('held', 'eligible', 'paid_out', 'cancelled');

-- AlterTable Subscription: crédit wallet sur abonnement
ALTER TABLE "Subscription" ADD COLUMN "creditUsed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable Mission: reversement prestataire
ALTER TABLE "Mission" ADD COLUMN "providerAmount" DECIMAL(65,30),
ADD COLUMN "payoutStatus" "MissionPayoutStatus",
ADD COLUMN "payoutEligibleAt" TIMESTAMP(3),
ADD COLUMN "paidOutAt" TIMESTAMP(3);

CREATE INDEX "Mission_payoutStatus_payoutEligibleAt_idx" ON "Mission"("payoutStatus", "payoutEligibleAt");

-- Backfill: missions déjà livrées → éligibles au reversement (admin peut verser)
UPDATE "Mission"
SET
  "providerAmount" = "price",
  "payoutStatus" = 'eligible',
  "payoutEligibleAt" = NOW()
WHERE "status" = 'delivered'
  AND "providerId" IS NOT NULL
  AND "payoutStatus" IS NULL;
