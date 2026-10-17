-- Timbre / vignette électronique de droit de plaidoirie (preuve vérifiable par affaire).
CREATE TABLE "Timbre" (
    "id"          SERIAL NOT NULL,
    "numero"      INTEGER NOT NULL,
    "code"        TEXT NOT NULL,
    "membreId"    INTEGER NOT NULL,
    "affaire"     TEXT NOT NULL,
    "reference"   TEXT,
    "juridiction" TEXT,
    "cabinet"     TEXT,
    "montant"     INTEGER NOT NULL,
    "statut"      TEXT NOT NULL DEFAULT 'VALIDE',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timbre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Timbre_numero_key" ON "Timbre"("numero");
CREATE UNIQUE INDEX "Timbre_code_key" ON "Timbre"("code");
CREATE INDEX "Timbre_membreId_idx" ON "Timbre"("membreId");

ALTER TABLE "Timbre" ADD CONSTRAINT "Timbre_membreId_fkey"
    FOREIGN KEY ("membreId") REFERENCES "Membre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
