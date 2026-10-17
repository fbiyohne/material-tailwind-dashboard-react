-- Audit de conformité (T2) — migration B : tables et colonnes.
-- Additive et idempotente : chaque instruction porte IF NOT EXISTS ou un contrôle
-- dans le catalogue ; aucune table ni colonne n'est retirée. Rejouable (CA14).

-- 1) Journal métier des changements de situation d'un membre (qui, quand, pourquoi, pièce).
CREATE TABLE IF NOT EXISTS "EvenementSituation" (
    "id"          SERIAL NOT NULL,
    "membreId"    INTEGER NOT NULL,
    "type"        TEXT NOT NULL,
    "statutAvant" "StatutMembre",
    "statutApres" "StatutMembre",
    "dateEffet"   TIMESTAMP(3) NOT NULL,
    "annee"       INTEGER,
    "motif"       TEXT,
    "reference"   TEXT,
    "pieceId"     INTEGER,
    "dossierId"   INTEGER,
    "details"     JSONB,
    "acteurId"    INTEGER,
    "acteurNom"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvenementSituation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EvenementSituation_membreId_dateEffet_idx" ON "EvenementSituation"("membreId", "dateEffet");
CREATE INDEX IF NOT EXISTS "EvenementSituation_type_annee_idx" ON "EvenementSituation"("type", "annee");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_membreId_fkey') THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_membreId_fkey"
      FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_pieceId_fkey') THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_pieceId_fkey"
      FOREIGN KEY ("pieceId") REFERENCES "PieceDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EvenementSituation_dossierId_fkey') THEN
    ALTER TABLE "EvenementSituation" ADD CONSTRAINT "EvenementSituation_dossierId_fkey"
      FOREIGN KEY ("dossierId") REFERENCES "DossierDisciplinaire"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Date de dernière mise à jour d'un membre (« Mis à jour le » du tableau PDF).
ALTER TABLE "Membre" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) Procédure et sanction structurées. Le champ texte "sanction" est conservé
--    (rempli avec le libellé) : aucune donnée existante n'est convertie.
ALTER TABLE "DossierDisciplinaire"
  ADD COLUMN IF NOT EXISTS "origine" TEXT,
  ADD COLUMN IF NOT EXISTS "dateDesignationRapporteur" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dateRapport" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "conclusionRapport" TEXT,
  ADD COLUMN IF NOT EXISTS "orientation" TEXT,
  ADD COLUMN IF NOT EXISTS "juridiction" TEXT,
  ADD COLUMN IF NOT EXISTS "sanctionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "sanctionDureeMois" INTEGER,
  ADD COLUMN IF NOT EXISTS "sursis" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sanctionDebut" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sanctionFin" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "peineAccessoireMois" INTEGER,
  ADD COLUMN IF NOT EXISTS "motivation" TEXT,
  ADD COLUMN IF NOT EXISTS "dateDecision" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dateNotification" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "decidePar" TEXT;

-- 4) Date du scrutin : base du corps électoral (X-03).
ALTER TABLE "Scrutin" ADD COLUMN IF NOT EXISTS "dateScrutin" TIMESTAMP(3);

-- 5) Messagerie : une pièce jointe par message, empreinte SHA-256, accusés reçu / lu.
ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "pieceNom" TEXT,
  ADD COLUMN IF NOT EXISTS "pieceFichier" TEXT,
  ADD COLUMN IF NOT EXISTS "pieceMime" TEXT,
  ADD COLUMN IF NOT EXISTS "pieceTaille" INTEGER,
  ADD COLUMN IF NOT EXISTS "empreinte" TEXT,
  ADD COLUMN IF NOT EXISTS "recuAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "luAt" TIMESTAMP(3);

-- 6) Demandes d'attestation archivées dans un fil administration.
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "attestationType" TEXT,
  ADD COLUMN IF NOT EXISTS "attestationNumero" TEXT;

-- 7) Timbres vendus hors application (dispositif MTN), importés par CSV/Excel.
--    La référence unique rend l'import idempotent.
CREATE TABLE IF NOT EXISTS "TimbreExterne" (
    "id"         SERIAL NOT NULL,
    "reference"  TEXT NOT NULL,
    "date"       TIMESTAMP(3) NOT NULL,
    "montant"    INTEGER NOT NULL,
    "canal"      TEXT NOT NULL,
    "source"     TEXT NOT NULL DEFAULT 'MTN',
    "avocatNom"  TEXT,
    "importePar" TEXT,
    "importeLe"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimbreExterne_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TimbreExterne_reference_key" ON "TimbreExterne"("reference");
CREATE INDEX IF NOT EXISTS "TimbreExterne_date_idx" ON "TimbreExterne"("date");

-- 8) Journal d'audit : filtre par utilisateur, et immuabilité en base.
CREATE INDEX IF NOT EXISTS "JournalAudit_userId_quand_idx" ON "JournalAudit"("userId", "quand");

CREATE OR REPLACE FUNCTION journal_audit_immuable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'JournalAudit est non modifiable (% refusé)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- Ne couvre pas TRUNCATE. Désactivation volontaire par un DBA :
-- ALTER TABLE "JournalAudit" DISABLE TRIGGER journal_audit_immuable (purge de conservation).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'journal_audit_immuable' AND tgrelid = '"JournalAudit"'::regclass
  ) THEN
    CREATE TRIGGER journal_audit_immuable
      BEFORE UPDATE OR DELETE ON "JournalAudit"
      FOR EACH ROW EXECUTE FUNCTION journal_audit_immuable();
  END IF;
END $$;
