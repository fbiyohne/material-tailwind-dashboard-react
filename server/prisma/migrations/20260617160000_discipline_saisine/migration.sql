-- Discipline enrichie : saisine (plaignant), rapporteur, recours.
ALTER TABLE "DossierDisciplinaire" ADD COLUMN "plaignant" TEXT;
ALTER TABLE "DossierDisciplinaire" ADD COLUMN "rapporteur" TEXT;
ALTER TABLE "DossierDisciplinaire" ADD COLUMN "recours" TEXT;
ALTER TABLE "DossierDisciplinaire" ADD COLUMN "dateRecours" TIMESTAMP(3);
