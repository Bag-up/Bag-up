-- Modes de livraison marketplace (retrait / Bag'up / commerçant / remise SN)
ALTER TABLE "MarketplaceOrder"
  ADD COLUMN IF NOT EXISTS "deliveryMode" TEXT NOT NULL DEFAULT 'bagup_courier';
