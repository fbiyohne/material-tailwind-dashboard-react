-- R1-2 : fin de validité du quitus figée à la délivrance (au lieu d'être recalculée
-- avec la règle courante regles.quitus.validiteMois). Additive et idempotente.
-- Les quitus antérieurs gardent NULL : l'application leur applique la règle d'alors (3 mois).
ALTER TABLE "Quitus" ADD COLUMN IF NOT EXISTS "finValidite" TIMESTAMP(3);
