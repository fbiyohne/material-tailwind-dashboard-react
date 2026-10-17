-- CreateTable : personne morale (cabinet / société / association d'avocats).
CREATE TABLE "Cabinet" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "forme" TEXT,
    "adresse" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "conventionDeposee" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'actif',
    "dateRetrait" TIMESTAMP(3),
    "motifRetrait" TEXT,
    "titulaireId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cabinet_pkey" PRIMARY KEY ("id")
);

-- AlterTable : rattachement structuré du membre à une personne morale.
ALTER TABLE "Membre" ADD COLUMN     "cabinetId" INTEGER;

-- Clés étrangères.
ALTER TABLE "Cabinet" ADD CONSTRAINT "Cabinet_titulaireId_fkey" FOREIGN KEY ("titulaireId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Membre" ADD CONSTRAINT "Membre_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "Cabinet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill : crée une personne morale par intitulé de cabinet distinct déjà saisi,
-- rattache les membres, puis désigne comme titulaire le membre le plus ancien.
INSERT INTO "Cabinet" ("nom", "forme")
  SELECT DISTINCT btrim("cabinet"), 'Cabinet individuel'
  FROM "Membre"
  WHERE "cabinet" IS NOT NULL AND btrim("cabinet") <> '';

UPDATE "Membre" m SET "cabinetId" = c."id"
  FROM "Cabinet" c
  WHERE btrim(m."cabinet") = c."nom";

UPDATE "Cabinet" c SET "titulaireId" = sub."id"
  FROM (
    SELECT DISTINCT ON (m."cabinetId") m."cabinetId" AS cid, m."id"
    FROM "Membre" m
    WHERE m."cabinetId" IS NOT NULL
    ORDER BY m."cabinetId", m."dateServment" ASC NULLS LAST, m."id" ASC
  ) sub
  WHERE c."id" = sub.cid;
