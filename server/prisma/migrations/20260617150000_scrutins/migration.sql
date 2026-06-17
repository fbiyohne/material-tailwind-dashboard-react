-- Élections : scrutins, candidats, émargements, bulletins anonymes + lien Conseil.
ALTER TABLE "MembreConseil" ADD COLUMN "membreId" INTEGER;
ALTER TABLE "MembreConseil" ADD COLUMN "mandatDebut" TIMESTAMP(3);
ALTER TABLE "MembreConseil" ADD COLUMN "mandatFin" TIMESTAMP(3);

CREATE TYPE "TypeScrutin" AS ENUM ('CONSEIL', 'BATONNIER', 'AUTRE');
CREATE TYPE "ModaliteScrutin" AS ENUM ('PRESENTIEL', 'EN_LIGNE');
CREATE TYPE "StatutScrutin" AS ENUM ('PREPARATION', 'OUVERT', 'CLOS', 'PUBLIE');

CREATE TABLE "Scrutin" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "TypeScrutin" NOT NULL,
    "modalite" "ModaliteScrutin" NOT NULL,
    "statut" "StatutScrutin" NOT NULL DEFAULT 'PREPARATION',
    "nbSieges" INTEGER NOT NULL DEFAULT 1,
    "ouvertLe" TIMESTAMP(3),
    "closLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scrutin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Candidat" (
    "id" SERIAL NOT NULL,
    "scrutinId" INTEGER NOT NULL,
    "membreId" INTEGER,
    "nom" TEXT NOT NULL,
    "voix" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Candidat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Candidat_scrutinId_idx" ON "Candidat"("scrutinId");

CREATE TABLE "Emargement" (
    "id" SERIAL NOT NULL,
    "scrutinId" INTEGER NOT NULL,
    "membreId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Emargement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Emargement_scrutinId_membreId_key" ON "Emargement"("scrutinId", "membreId");

CREATE TABLE "Bulletin" (
    "id" SERIAL NOT NULL,
    "scrutinId" INTEGER NOT NULL,
    "candidatId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bulletin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bulletin_scrutinId_idx" ON "Bulletin"("scrutinId");

ALTER TABLE "Candidat" ADD CONSTRAINT "Candidat_scrutinId_fkey" FOREIGN KEY ("scrutinId") REFERENCES "Scrutin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Emargement" ADD CONSTRAINT "Emargement_scrutinId_fkey" FOREIGN KEY ("scrutinId") REFERENCES "Scrutin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_scrutinId_fkey" FOREIGN KEY ("scrutinId") REFERENCES "Scrutin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bulletin" ADD CONSTRAINT "Bulletin_candidatId_fkey" FOREIGN KEY ("candidatId") REFERENCES "Candidat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
