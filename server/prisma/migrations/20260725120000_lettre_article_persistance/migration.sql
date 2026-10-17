-- AlterTable : persistance de l'article de la Lettre du Bâtonnier par mois
-- (texte rédigé/amendé, origine IA ou gabarit, date de dernière mise à jour).
ALTER TABLE "CalendrierEditorial" ADD COLUMN     "texte" TEXT;
ALTER TABLE "CalendrierEditorial" ADD COLUMN     "simule" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CalendrierEditorial" ADD COLUMN     "dateMaj" TIMESTAMP(3);
