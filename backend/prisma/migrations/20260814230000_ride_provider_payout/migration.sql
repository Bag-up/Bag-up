-- Reversement chauffeur courses (même cycle J+2 que missions)
ALTER TABLE "Ride" ADD COLUMN IF NOT EXISTS "providerAmount" DECIMAL(65,30),
ADD COLUMN IF NOT EXISTS "payoutStatus" "MissionPayoutStatus",
ADD COLUMN IF NOT EXISTS "payoutEligibleAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Ride_payoutStatus_payoutEligibleAt_idx" ON "Ride"("payoutStatus", "payoutEligibleAt");
