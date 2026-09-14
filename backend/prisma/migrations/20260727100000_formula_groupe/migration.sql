-- Formule Groupé : enum + multiplicateur tarif
ALTER TYPE "UrgencyLevel" ADD VALUE IF NOT EXISTS 'groupe';

ALTER TABLE "Tariff" ADD COLUMN IF NOT EXISTS "groupeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.8;
