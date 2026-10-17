-- CreateEnum
CREATE TYPE "StatutPaiement" AS ENUM ('INITIE', 'EN_ATTENTE', 'REUSSI', 'ECHEC');

-- CreateTable
CREATE TABLE "Paiement" (
    "id" SERIAL NOT NULL,
    "ref" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "membreId" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "statut" "StatutPaiement" NOT NULL DEFAULT 'INITIE',
    "recuNumero" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Paiement_ref_key" ON "Paiement"("ref");

-- CreateIndex
CREATE INDEX "Paiement_membreId_idx" ON "Paiement"("membreId");

-- AddForeignKey
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
