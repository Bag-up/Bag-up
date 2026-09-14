-- AlterTable Payment: missionId optional + rideId
ALTER TABLE "Payment" ALTER COLUMN "missionId" DROP NOT NULL;

ALTER TABLE "Payment" ADD COLUMN "rideId" TEXT;

CREATE INDEX "Payment_rideId_idx" ON "Payment"("rideId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Rating: missionId optional + rideId
ALTER TABLE "Rating" ALTER COLUMN "missionId" DROP NOT NULL;

ALTER TABLE "Rating" ADD COLUMN "rideId" TEXT;

CREATE INDEX "Rating_rideId_idx" ON "Rating"("rideId");

ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;
