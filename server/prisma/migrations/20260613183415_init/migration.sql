-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SECRETAIRE_GENERAL', 'BATONNIER', 'TRESORIERE', 'ADMIN');

-- CreateEnum
CREATE TYPE "Qualite" AS ENUM ('AVOCAT', 'STAGIAIRE', 'HONORAIRE');

-- CreateEnum
CREATE TYPE "StatutMembre" AS ENUM ('INSCRIT', 'SUSPENDU', 'RADIE', 'OMIS', 'HONORAIRE', 'STAGIAIRE');

-- CreateEnum
CREATE TYPE "TypeAssemblee" AS ENUM ('AGO', 'AGE');

-- CreateEnum
CREATE TYPE "StatutDossier" AS ENUM ('OUVERT', 'INSTRUCTION', 'AUDIENCE', 'DECISION', 'CLASSE');

-- CreateEnum
CREATE TYPE "StatutPublication" AS ENUM ('BROUILLON', 'A_VALIDER', 'VALIDE', 'PUBLIE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membre" (
    "id" SERIAL NOT NULL,
    "num" INTEGER NOT NULL,
    "numInscription" TEXT,
    "nom" TEXT NOT NULL,
    "qualite" "Qualite" NOT NULL,
    "statut" "StatutMembre" NOT NULL DEFAULT 'INSCRIT',
    "cabinet" TEXT,
    "tel" TEXT,
    "email" TEXT,
    "rccm" TEXT,
    "cnss" TEXT,
    "adresse" TEXT,
    "dateNaissance" TIMESTAMP(3),
    "dateInscription" TIMESTAMP(3),
    "observations" TEXT,
    "dateServment" TIMESTAMP(3),
    "dureeMois" INTEGER,
    "maitreStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotisation" (
    "id" SERIAL NOT NULL,
    "membreId" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "montantDu" INTEGER NOT NULL,
    "montantPaye" INTEGER NOT NULL DEFAULT 0,
    "datePaiement" TIMESTAMP(3),
    "mode" TEXT,
    "ref" TEXT,
    "valideTresoriere" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Cotisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recu" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "membreId" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "ref" TEXT,
    "objet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quitus" (
    "id" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "membreId" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quitus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierDisciplinaire" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "membreId" INTEGER,
    "avocatNom" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "dateSaisine" TIMESTAMP(3) NOT NULL,
    "dateConvocation" TIMESTAMP(3),
    "dateAudience" TIMESTAMP(3),
    "decision" TEXT,
    "sanction" TEXT,
    "statut" "StatutDossier" NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierDisciplinaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reunion" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "heure" TEXT,
    "lieu" TEXT,
    "ordreDuJour" TEXT[],
    "statut" TEXT NOT NULL DEFAULT 'planifiee',
    "pv" TEXT,
    "presences" JSONB,

    CONSTRAINT "Reunion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assemblee" (
    "id" SERIAL NOT NULL,
    "type" "TypeAssemblee" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lieu" TEXT,
    "ordreDuJour" TEXT[],
    "quorumPresent" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'convoquee',
    "decisions" TEXT[],
    "pv" TEXT,

    CONSTRAINT "Assemblee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Archive" (
    "id" SERIAL NOT NULL,
    "categorie" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "reference" TEXT,
    "date" TIMESTAMP(3),
    "membreNom" TEXT,
    "archiveLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contenu" TEXT,
    "statut" "StatutPublication" NOT NULL DEFAULT 'A_VALIDER',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalDiscipline" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "quand" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "JournalDiscipline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membre_num_key" ON "Membre"("num");

-- CreateIndex
CREATE UNIQUE INDEX "Membre_numInscription_key" ON "Membre"("numInscription");

-- CreateIndex
CREATE INDEX "Cotisation_annee_idx" ON "Cotisation"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "Cotisation_membreId_annee_key" ON "Cotisation"("membreId", "annee");

-- CreateIndex
CREATE UNIQUE INDEX "Recu_numero_key" ON "Recu"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Quitus_numero_key" ON "Quitus"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "DossierDisciplinaire_reference_key" ON "DossierDisciplinaire"("reference");

-- AddForeignKey
ALTER TABLE "Cotisation" ADD CONSTRAINT "Cotisation_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recu" ADD CONSTRAINT "Recu_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quitus" ADD CONSTRAINT "Quitus_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierDisciplinaire" ADD CONSTRAINT "DossierDisciplinaire_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
