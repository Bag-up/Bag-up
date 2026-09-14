-- Un même numéro peut avoir un compte client, prestataire et commerçant.
-- L'unicité porte désormais sur (téléphone, rôle).
DROP INDEX IF EXISTS "User_phone_key";
CREATE UNIQUE INDEX "User_phone_role_key" ON "User"("phone", "role");
