-- Cycle de vie des avocats : statut DECEDE + traçabilité radiation/décès.
-- Additive et idempotente. Aucun UPDATE ni usage de la valeur DECEDE ici :
-- PostgreSQL interdit d'utiliser une valeur d'enum dans la transaction qui la crée.
ALTER TYPE "StatutMembre" ADD VALUE IF NOT EXISTS 'DECEDE';
ALTER TABLE "Membre"
  ADD COLUMN IF NOT EXISTS "dateRadiation" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "motifRadiation" TEXT,
  ADD COLUMN IF NOT EXISTS "dateDeces" TIMESTAMP(3);
