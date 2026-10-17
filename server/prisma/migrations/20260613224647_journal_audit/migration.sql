-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "cible" TEXT,
    "methode" TEXT NOT NULL,
    "chemin" TEXT NOT NULL,
    "statut" INTEGER NOT NULL,
    "userId" INTEGER,
    "userNom" TEXT,
    "quand" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalAudit_quand_idx" ON "JournalAudit"("quand");
