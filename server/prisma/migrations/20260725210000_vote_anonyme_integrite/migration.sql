-- Secret du vote : suppression des bulletins individuels. Le décompte du vote en
-- ligne est désormais agrégé dans Candidat.voix (incrémenté à chaque vote), donc
-- aucun enregistrement ne relie un votant à son choix (même via l'ordre d'insertion).
DROP TABLE IF EXISTS "Bulletin";

-- Nettoyage des références pendantes AVANT l'ajout des clés étrangères
-- (émargements/candidatures/mandats pointant vers un membre supprimé).
DELETE FROM "Emargement" WHERE "membreId" NOT IN (SELECT "id" FROM "Membre");
UPDATE "Candidat" SET "membreId" = NULL WHERE "membreId" IS NOT NULL AND "membreId" NOT IN (SELECT "id" FROM "Membre");
UPDATE "MembreConseil" SET "membreId" = NULL WHERE "membreId" IS NOT NULL AND "membreId" NOT IN (SELECT "id" FROM "Membre");

-- Clés étrangères sur les colonnes membreId (jusque-là entiers nus → orphelins possibles).
ALTER TABLE "Emargement" ADD CONSTRAINT "Emargement_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Candidat" ADD CONSTRAINT "Candidat_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MembreConseil" ADD CONSTRAINT "MembreConseil_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unicité du quitus par (membre, année) — défense en profondeur (garde applicative déjà en place).
CREATE UNIQUE INDEX "Quitus_membreId_annee_key" ON "Quitus"("membreId", "annee");

-- Compteur atomique de numérotation officielle (attestations…).
CREATE TABLE "Compteur" (
    "cle"    TEXT NOT NULL,
    "valeur" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Compteur_pkey" PRIMARY KEY ("cle")
);

-- Amorçage du compteur d'attestations au plus grand numéro déjà émis, pour
-- poursuivre la numérotation ATT-AAAA-NNN sans collision ni régression.
INSERT INTO "Compteur" ("cle", "valeur")
SELECT 'ATT-' || split_part("reference", '-', 2),
       MAX(NULLIF(split_part("reference", '-', 3), '')::int)
FROM "Archive"
WHERE "categorie" = 'Attestation d''inscription' AND "reference" LIKE 'ATT-%-%'
GROUP BY split_part("reference", '-', 2);
