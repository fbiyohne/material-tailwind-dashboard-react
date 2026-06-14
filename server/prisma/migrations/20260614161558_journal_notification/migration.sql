-- CreateTable
CREATE TABLE "JournalNotification" (
    "id" SERIAL NOT NULL,
    "canal" TEXT NOT NULL,
    "destinataire" TEXT NOT NULL,
    "sujet" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "simulation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalNotification_createdAt_idx" ON "JournalNotification"("createdAt");
