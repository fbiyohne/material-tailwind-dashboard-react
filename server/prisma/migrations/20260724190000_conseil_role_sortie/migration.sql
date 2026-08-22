-- AlterTable : rôle structuré + sortie motivée pour la composition du Conseil.
ALTER TABLE "MembreConseil" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'membre';
ALTER TABLE "MembreConseil" ADD COLUMN     "sigle" TEXT;
ALTER TABLE "MembreConseil" ADD COLUMN     "motifSortie" TEXT;

-- Backfill du rôle depuis l'intitulé de fonction existant (best-effort).
UPDATE "MembreConseil" SET "role" = 'batonnier'
  WHERE "role" = 'membre' AND (lower("fonction") LIKE '%bâtonnier%' OR lower("fonction") LIKE '%batonnier%');
UPDATE "MembreConseil" SET "role" = 'bureau'
  WHERE "role" = 'membre' AND (
    lower("fonction") LIKE '%secrétaire%' OR lower("fonction") LIKE '%secretaire%'
    OR lower("fonction") LIKE '%trésor%' OR lower("fonction") LIKE '%tresor%'
  );
