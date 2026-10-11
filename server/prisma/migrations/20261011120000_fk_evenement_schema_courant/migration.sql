-- R1-13 : clés étrangères de "EvenementSituation" dans le schéma courant.
-- La migration 20261010090100 contrôlait leur existence par le seul nom (pg_constraint.conname),
-- tous schémas confondus : rejouée dans un second schéma de la même base (schéma `demo` du congrès),
-- elle ne les créait pas. Contrôle ici par la table du schéma courant. Additive et idempotente :
-- sans effet là où les contraintes existent déjà (schéma public, production).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_membreId_fkey' AND conrelid = '"EvenementSituation"'::regclass) THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_membreId_fkey"
      FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_pieceId_fkey' AND conrelid = '"EvenementSituation"'::regclass) THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_pieceId_fkey"
      FOREIGN KEY ("pieceId") REFERENCES "PieceDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_dossierId_fkey' AND conrelid = '"EvenementSituation"'::regclass) THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_dossierId_fkey"
      FOREIGN KEY ("dossierId") REFERENCES "DossierDisciplinaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
