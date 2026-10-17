-- Alignement avec la règle « règlement intégral = validation Trésorière » (BR-01).
-- Les cotisations déjà soldées avant l'introduction de cette règle sont
-- rétroactivement marquées « validées », pour que les avocats à jour
-- apparaissent immédiatement comme éligibles au quitus.
UPDATE "Cotisation"
SET "valideTresoriere" = true
WHERE "montantPaye" >= "montantDu"
  AND "montantPaye" > 0
  AND "valideTresoriere" = false;
