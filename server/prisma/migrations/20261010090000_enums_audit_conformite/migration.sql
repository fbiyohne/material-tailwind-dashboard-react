-- Audit de conformité (T2) — migration A : valeurs d'enum seules.
-- Additive et idempotente. Fichier séparé : PostgreSQL interdit d'utiliser une
-- valeur d'enum dans la transaction qui la crée.
-- Sorties volontaires du tableau (hors tableau, corps électoral et annuaire).
ALTER TYPE "StatutMembre" ADD VALUE IF NOT EXISTS 'DEMISSIONNAIRE';
ALTER TYPE "StatutMembre" ADD VALUE IF NOT EXISTS 'RETRAITE';
ALTER TYPE "StatutMembre" ADD VALUE IF NOT EXISTS 'CESSATION';
-- Scrutin du Conseil du barreau (distinct du Conseil de l'Ordre national).
ALTER TYPE "TypeScrutin" ADD VALUE IF NOT EXISTS 'CONSEIL_BARREAU';
