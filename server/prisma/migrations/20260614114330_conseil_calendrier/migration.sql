-- CreateTable
CREATE TABLE "MembreConseil" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MembreConseil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendrierEditorial" (
    "id" SERIAL NOT NULL,
    "mois" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'a_rediger',
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CalendrierEditorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendrierEditorial_mois_key" ON "CalendrierEditorial"("mois");
