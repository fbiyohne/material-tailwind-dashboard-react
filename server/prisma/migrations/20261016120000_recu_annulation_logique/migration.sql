-- R2-5 : annulation LOGIQUE des reçus (avis juridique : aucun reçu émis ne s'efface,
-- numérotation continue sans trou, conservation des pièces comptables).
-- Additive et idempotente : les reçus existants prennent le statut EMIS.
ALTER TABLE "Recu" ADD COLUMN IF NOT EXISTS "statut" TEXT NOT NULL DEFAULT 'EMIS';
ALTER TABLE "Recu" ADD COLUMN IF NOT EXISTS "annuleLe" TIMESTAMP(3);
ALTER TABLE "Recu" ADD COLUMN IF NOT EXISTS "motifAnnulation" TEXT;
ALTER TABLE "Recu" ADD COLUMN IF NOT EXISTS "annuleParId" INTEGER;
