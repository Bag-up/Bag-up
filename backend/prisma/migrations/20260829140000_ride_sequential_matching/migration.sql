-- Matching courses séquentiel (offre exclusive + position presta)

CREATE TYPE "RideOfferStatus" AS ENUM ('pending', 'accepted', 'refused', 'expired', 'cancelled');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lastLat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "lastLocationAt" TIMESTAMP(3);

ALTER TABLE "Ride"
  ADD COLUMN IF NOT EXISTS "matchingRank" INTEGER;

CREATE TABLE "RideOffer" (
  "id" TEXT NOT NULL,
  "rideId" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "status" "RideOfferStatus" NOT NULL DEFAULT 'pending',
  "rank" INTEGER NOT NULL,
  "distanceKm" DOUBLE PRECISION,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RideOffer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RideOffer_rideId_status_idx" ON "RideOffer"("rideId", "status");
CREATE INDEX "RideOffer_driverId_status_idx" ON "RideOffer"("driverId", "status");
CREATE INDEX "RideOffer_status_expiresAt_idx" ON "RideOffer"("status", "expiresAt");
CREATE INDEX "RideOffer_rideId_driverId_idx" ON "RideOffer"("rideId", "driverId");

ALTER TABLE "RideOffer"
  ADD CONSTRAINT "RideOffer_rideId_fkey"
  FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RideOffer"
  ADD CONSTRAINT "RideOffer_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
