-- CreateTable
CREATE TABLE "DroitPlaidoirie" (
    "id" SERIAL NOT NULL,
    "membreId" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,
    "montantDu" INTEGER NOT NULL,
    "montantPaye" INTEGER NOT NULL DEFAULT 0,
    "datePaiement" TIMESTAMP(3),
    "mode" TEXT,
    "ref" TEXT,

    CONSTRAINT "DroitPlaidoirie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DroitPlaidoirie_annee_idx" ON "DroitPlaidoirie"("annee");

-- CreateIndex
CREATE UNIQUE INDEX "DroitPlaidoirie_membreId_annee_key" ON "DroitPlaidoirie"("membreId", "annee");

-- AddForeignKey
ALTER TABLE "DroitPlaidoirie" ADD CONSTRAINT "DroitPlaidoirie_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
