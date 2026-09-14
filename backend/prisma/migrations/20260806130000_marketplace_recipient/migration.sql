-- AlterTable
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "deliverToSelf" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "recipientRelation" TEXT;
