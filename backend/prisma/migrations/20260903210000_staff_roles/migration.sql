-- AlterEnum: rôles staff back-office
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'assistant';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
