-- Cycle du stage : validation de fin de stage + rapports périodiques.
ALTER TABLE "Membre" ADD COLUMN "stageValideAt" TIMESTAMP(3);
ALTER TABLE "Membre" ADD COLUMN "stageValidePar" TEXT;

CREATE TABLE "RapportStage" (
    "id" SERIAL NOT NULL,
    "membreId" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appreciation" TEXT NOT NULL,
    "note" TEXT,
    "auteur" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RapportStage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RapportStage_membreId_idx" ON "RapportStage"("membreId");
ALTER TABLE "RapportStage" ADD CONSTRAINT "RapportStage_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
