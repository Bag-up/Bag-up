-- Programme fidélité client (paliers Ivoire → Gold).
CREATE TYPE "LoyaltyRewardType" AS ENUM ('voucher', 'antigaspi_gift');
CREATE TYPE "LoyaltyRewardStatus" AS ENUM ('available', 'used', 'expired');

ALTER TYPE "NotificationType" ADD VALUE 'loyalty';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "loyaltyCompletedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "loyaltyTier" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "loyaltyGoldMonthKey" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "loyaltyRewardId" TEXT;

ALTER TABLE "AntiGaspiReservation"
  ADD COLUMN IF NOT EXISTS "loyaltyRewardId" TEXT;

CREATE TABLE "LoyaltyReward" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "LoyaltyRewardType" NOT NULL,
  "status" "LoyaltyRewardStatus" NOT NULL DEFAULT 'available',
  "amount" INTEGER NOT NULL,
  "tier" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "usedOnType" TEXT,
  "usedOnId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoyaltyReward_userId_status_idx" ON "LoyaltyReward"("userId", "status");
CREATE INDEX "LoyaltyReward_userId_type_source_tier_idx" ON "LoyaltyReward"("userId", "type", "source", "tier");

ALTER TABLE "LoyaltyReward"
  ADD CONSTRAINT "LoyaltyReward_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
