import type { StatutMembre } from "@prisma/client";
import { HttpError } from "../middleware/error.js";

/** Partie « cycle de vie » d'une fiche membre. */
export interface EtatCycleVie {
  statut: StatutMembre;
  dateRadiation: Date | null;
  motifRadiation: string | null;
  dateDeces: Date | null;
}

/** Demande de changement : undefined = non touché, null = effacé. */
export type DemandeCycleVie = Partial<EtatCycleVie>;

/**
 * Machine à états unique du cycle de vie (PATCH, /radier, /deces). Retourne l'état
 * complet à écrire ; lève HttpError si la transition ou l'acte est invalide.
 *
 * Règles :
 *  - invariant : dateRadiation/motifRadiation n'existent que si statut = RADIE,
 *    dateDeces que si statut = DECEDE. Toute donnée d'acte d'un autre statut est
 *    effacée (retour à un statut régulier = correction de saisie ; décès après
 *    radiation = le décès supplante la radiation) ; la trace reste dans JournalAudit ;
 *  - RADIE et DECEDE exigent leur date d'acte (celle de la demande, sinon celle en base) ;
 *  - un décédé ne peut pas être radié (RADIE ← DECEDE refusé, 409) ;
 *  - le statut inchangé conserve les données d'acte existantes.
 */
export function appliquerCycleVie(actuel: EtatCycleVie, demande: DemandeCycleVie): EtatCycleVie {
  const statut = demande.statut ?? actuel.statut;
  if (statut === "RADIE" && actuel.statut === "DECEDE")
    throw new HttpError(409, "Un avocat décédé ne peut pas être radié : rétablissez d'abord son statut par la fiche si le décès a été saisi par erreur.");
  const choisir = <T,>(v: T | undefined, ancien: T): T => (v === undefined ? ancien : v);
  const radie = statut === "RADIE";
  const decede = statut === "DECEDE";
  const etat: EtatCycleVie = {
    statut,
    dateRadiation: radie ? choisir(demande.dateRadiation, actuel.dateRadiation) : null,
    motifRadiation: radie ? choisir(demande.motifRadiation, actuel.motifRadiation) : null,
    dateDeces: decede ? choisir(demande.dateDeces, actuel.dateDeces) : null,
  };
  if (radie && !etat.dateRadiation) throw new HttpError(400, "La date de la décision de radiation est obligatoire pour un avocat radié.");
  if (decede && !etat.dateDeces) throw new HttpError(400, "La date du décès est obligatoire pour un avocat décédé.");
  return etat;
}
