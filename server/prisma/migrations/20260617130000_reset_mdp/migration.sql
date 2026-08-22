-- Réinitialisation de mot de passe en self-service (token à durée limitée).
ALTER TABLE "User" ADD COLUMN "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "resetExpire" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");
