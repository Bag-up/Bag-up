-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'cash';

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN IF NOT EXISTS "cashConfirmedAt" TIMESTAMP(3);
