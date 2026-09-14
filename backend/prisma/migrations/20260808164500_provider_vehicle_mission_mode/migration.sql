-- CreateTable
CREATE TABLE "ProviderVehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "plate" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "color" TEXT,
    "photoUrl" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderVehicle_userId_key" ON "ProviderVehicle"("userId");

-- AddForeignKey
ALTER TABLE "ProviderVehicle" ADD CONSTRAINT "ProviderVehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "vehicleMode" TEXT;

-- Backfill vehicles from legacy User.vehicleType for existing providers
INSERT INTO "ProviderVehicle" ("id", "userId", "type", "createdAt", "updatedAt")
SELECT md5(u."id" || '-provider-vehicle'), u."id", u."vehicleType", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'provider'
  AND u."vehicleType" IS NOT NULL
  AND u."vehicleType" <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ProviderVehicle" pv WHERE pv."userId" = u."id"
  );
