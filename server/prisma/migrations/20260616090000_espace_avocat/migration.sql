-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AVOCAT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activationExpire" TIMESTAMP(3),
ADD COLUMN     "activationToken" TEXT,
ADD COLUMN     "membreId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "User_membreId_key" ON "User"("membreId");

-- CreateIndex
CREATE UNIQUE INDEX "User_activationToken_key" ON "User"("activationToken");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_membreId_fkey" FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
