-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM (
  'searching',
  'assigned',
  'driver_en_route',
  'driver_arrived',
  'in_progress',
  'completed',
  'cancelled'
);

-- CreateTable
CREATE TABLE "Ride" (
    "id" TEXT NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'searching',
    "vehicleMode" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "pickupLat" TEXT,
    "pickupLng" TEXT,
    "dropoffLat" TEXT,
    "dropoffLng" TEXT,
    "estimatedPrice" DECIMAL(65,30) NOT NULL,
    "estimatedDistanceKm" DOUBLE PRECISION,
    "estimatedDurationMin" INTEGER,
    "finalPrice" DECIMAL(65,30),
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT,
    "driverLat" TEXT,
    "driverLng" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "driverRating" DOUBLE PRECISION,
    "vehicleType" TEXT,
    "vehiclePlate" TEXT,
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "vehicleColor" TEXT,
    "assignedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ride_status_vehicleMode_createdAt_idx" ON "Ride"("status", "vehicleMode", "createdAt");

-- CreateIndex
CREATE INDEX "Ride_passengerId_createdAt_idx" ON "Ride"("passengerId", "createdAt");

-- CreateIndex
CREATE INDEX "Ride_driverId_createdAt_idx" ON "Ride"("driverId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
