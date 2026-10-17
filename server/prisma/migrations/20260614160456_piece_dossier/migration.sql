-- CreateEnum
CREATE TYPE "StatutPiece" AS ENUM ('A_VERIFIER', 'VERIFIEE', 'REJETEE');

-- CreateTable
CREATE TABLE "PieceDossier" (
    "id" SERIAL NOT NULL,
    "membreId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "fichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "statut" "StatutPiece" NOT NULL DEFAULT 'A_VERIFIER',
    "note" TEXT,
    "verifieePar" TEXT,
    "verifieeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PieceDossier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PieceDossier_membreId_idx" ON "PieceDossier"("membreId");

-- AddForeignKey
ALTER TABLE "PieceDossier" ADD CONSTRAINT "PieceDossier_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
