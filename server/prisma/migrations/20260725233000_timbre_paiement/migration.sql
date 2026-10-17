-- Paiement (canal mobile money + référence de transaction) rattaché au timbre.
ALTER TABLE "Timbre" ADD COLUMN "canal" TEXT;
ALTER TABLE "Timbre" ADD COLUMN "refPaiement" TEXT;
