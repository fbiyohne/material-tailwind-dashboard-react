-- Centre de notifications in-app : une alerte par utilisateur destinataire.
-- Distinct de "JournalNotification" (journal des emails/SMS émis).
CREATE TABLE "Notification" (
    "id"        SERIAL NOT NULL,
    "userId"    INTEGER NOT NULL,
    "type"      TEXT NOT NULL,
    "titre"     TEXT NOT NULL,
    "message"   TEXT NOT NULL,
    "lien"      TEXT,
    "lu"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_lu_idx" ON "Notification"("userId", "lu");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
