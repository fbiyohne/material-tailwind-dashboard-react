import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { prochainNumeroTimbre, archiver } from "./business.js";
import { nouvelleReference } from "./paiement.js";

/** Montant officiel du droit de plaidoirie par timbre (FCFA). */
export const MONTANT_TIMBRE = 15000;

const LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/**
 * Identifiant lisible : préfixe distinctif (cabinet/nom, mot générique de tête
 * retiré) + segment aléatoire. Ex. « CABINET KALINA » → « KALINAUKXEFTQIKHL ».
 */
export function genererCodeTimbre(base: string): string {
  const distinctif = (base || "").replace(/^\s*(cabinet|scpa?|société|societe|association|selarl)\s+/i, "");
  const prefixe = distinctif.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "BPN";
  const alea = Array.from(crypto.randomBytes(10)).map((b) => LETTRES[b % 26]).join("");
  return prefixe + alea;
}

export interface OptionsTimbre {
  membre: { id: number; nom: string; cabinet: string | null };
  affaire: string;
  reference?: string;
  juridiction?: string;
  montant: number;
  canal?: string;
}

/**
 * Émet un timbre : n° séquentiel atomique, identifiant unique (rejoue le code en
 * cas de collision @unique), paiement rattaché, archivage. Partagé par le
 * back-office et l'espace avocat.
 */
export async function emettreTimbre(opts: OptionsTimbre) {
  const { membre } = opts;
  const numero = await prochainNumeroTimbre();
  const refPaiement = nouvelleReference();
  let timbre;
  for (let tentative = 0; ; tentative++) {
    try {
      timbre = await prisma.timbre.create({
        data: {
          numero,
          code: genererCodeTimbre(membre.cabinet ?? membre.nom),
          membreId: membre.id,
          affaire: opts.affaire,
          reference: opts.reference,
          juridiction: opts.juridiction,
          cabinet: membre.cabinet,
          montant: opts.montant,
          canal: opts.canal,
          refPaiement,
        },
      });
      break;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < 5) continue;
      throw e;
    }
  }
  await archiver({
    categorie: "Timbre — droit de plaidoirie",
    titre: `Timbre N° ${numero} — Me ${membre.nom} (${opts.affaire})`,
    reference: String(numero),
    date: new Date(),
    membreNom: membre.nom,
  });
  return timbre;
}
