-- CreateEnum
CREATE TYPE "StatutDemande" AS ENUM ('EN_ATTENTE', 'APPROUVEE', 'REFUSEE');

-- CreateTable
CREATE TABLE "DemandeAcces" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "numInscription" TEXT,
    "cabinet" TEXT,
    "motif" TEXT NOT NULL,
    "statut" "StatutDemande" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traiteeAt" TIMESTAMP(3),

    CONSTRAINT "DemandeAcces_pkey" PRIMARY KEY ("id")
);
