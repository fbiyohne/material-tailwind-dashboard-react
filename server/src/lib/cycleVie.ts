import type { Prisma, StatutMembre } from "@prisma/client";
import { HttpError } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { synchroniserAccesAuStatut } from "./acces.js";
import { realtimeTous } from "./realtime.js";
import { estRecuDroit, eligibiliteElectorale, tarifsActuels } from "./business.js";
import { reglesActuelles, type Regles } from "./regles.js";

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

// ─── Changement de situation tracé (D5) ──────────────────────────────────────

export interface ChangementSituation {
  membreId: number;
  /** Type d'événement (INSCRIPTION, PASSAGE_TABLEAU, OMISSION, RADIATION, DECES…). */
  type: string;
  /** Statut et actes demandés, contrôlés par appliquerCycleVie ; absent = statut inchangé. */
  demande?: DemandeCycleVie;
  /** Autres champs de la fiche écrits dans la même transaction (qualité, date d'inscription…). */
  donnees?: Prisma.MembreUpdateInput;
  dateEffet?: Date;
  annee?: number | null;
  motif?: string | null;
  reference?: string | null;
  pieceId?: number | null;
  dossierId?: number | null;
  details?: Prisma.InputJsonValue;
  acteur?: { id: number | null; nom: string | null } | null;
}

/**
 * Point d'écriture unique d'un changement de situation : machine à états, mise à
 * jour de la fiche et EvenementSituation (statut avant/après, acteur, pièce) dans
 * une seule transaction — tout ou rien.
 * Concurrence (R1-11) : la fiche est verrouillée (SELECT … FOR UPDATE) avant lecture ;
 * deux transitions d'un même membre s'exécutent donc l'une après l'autre et le
 * statutAvant de la seconde est le statutApres de la première. L'accès à l'espace
 * avocat est recalé dans la même transaction, d'après le statut final : il ne peut
 * pas contredire la fiche, et tout passage ici répare un écart antérieur
 * (réconciliation). Seul le signal temps réel « tableau » part après validation.
 * `avantEffet` (facultatif) s'exécute en tête de la même transaction : une écriture
 * liée (ex. réservation du dossier disciplinaire) réussit ou échoue avec l'effet.
 */
export async function changerSituation(c: ChangementSituation, avantEffet?: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  const { membre, evenement } = await prisma.$transaction(async (tx) => {
    if (avantEffet) await avantEffet(tx);
    await tx.$queryRaw`SELECT id FROM "Membre" WHERE id = ${c.membreId} FOR UPDATE`;
    const actuel = await tx.membre.findUnique({ where: { id: c.membreId } });
    if (!actuel) throw new HttpError(404, "Avocat introuvable");
    const etat = appliquerCycleVie(actuel, c.demande ?? {});
    const membre = await tx.membre.update({ where: { id: actuel.id }, data: { ...c.donnees, ...etat } });
    const evenement = await tx.evenementSituation.create({
      data: {
        membreId: actuel.id,
        type: c.type,
        statutAvant: actuel.statut,
        statutApres: membre.statut,
        dateEffet: c.dateEffet ?? new Date(),
        annee: c.annee ?? null,
        motif: c.motif ?? null,
        reference: c.reference ?? null,
        pieceId: c.pieceId ?? null,
        dossierId: c.dossierId ?? null,
        details: c.details,
        acteurId: c.acteur?.id ?? null,
        acteurNom: c.acteur?.nom ?? null,
      },
    });
    await synchroniserAccesAuStatut(membre.id, membre.statut, tx);
    return { membre, evenement };
  });
  realtimeTous({ type: "tableau" });
  return { membre, evenement };
}

// ─── Situation à une date (D10) ──────────────────────────────────────────────

export interface EvenementDate { dateEffet: Date; statutAvant: StatutMembre | null; statutApres: StatutMembre | null }
export interface SanctionDate {
  sursis: boolean;
  sanctionDebut: Date | null;
  sanctionFin: Date | null;
  peineAccessoireMois: number | null;
  dateDecision: Date | null;
}
export interface RecuDate { annee: number; montant: number; date: Date; objet: string | null }
export interface MembreDate {
  statut: StatutMembre;
  dateInscription: Date | null;
  cotisations?: { annee: number; montantDu: number; montantPaye: number; datePaiement: Date | null }[];
}
export interface SituationADate {
  /** Statut à la date ; null si le membre n'était pas encore inscrit. */
  statut: StatutMembre | null;
  /** Interdiction temporaire avec sursis couvrant la date (mention, sans effet sur le statut). */
  sursis: boolean;
  /** Peine accessoire d'inéligibilité en cours à la date. */
  ineligible: boolean;
  /** Exercice (civil) de la date. */
  annee: number;
  /** Cotisation de l'exercice payée à la date ; null sans ligne (le dû se calcule alors sur le barème). */
  cotisation: { montantDu: number; montantPaye: number } | null;
}

const ajouterMois = (d: Date, mois: number) => { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + mois); return r; };

/**
 * Situation d'un membre à la date D (incluse), fonction pure. Règles (D10) :
 *  - statut du dernier événement daté au plus tard de D ; à défaut, statut d'avant le
 *    premier événement postérieur ; à défaut, statut courant (limite PO-20 : fiable
 *    seulement depuis le début de la journalisation) ;
 *  - inscription postérieure à D : statut null ;
 *  - interdiction ferme couvrant D (sanctionDebut ≤ D ≤ sanctionFin) : un inscrit compte SUSPENDU ;
 *    avec sursis, il reste inscrit et `sursis` est vrai ;
 *  - peine accessoire : inéligible de dateDecision (à défaut sanctionDebut) à + peineAccessoireMois ;
 *  - cotisation payée à D : somme des reçus de cotisation (estRecuDroit) de l'exercice datés
 *    au plus tard de D ; sans aucun reçu de cotisation pour l'exercice, la ligne Cotisation
 *    compte si datePaiement ≤ D.
 * L'appelant passe D en fin de journée s'il veut inclure les paiements du jour.
 */
export function situationADate(
  membre: MembreDate,
  evenements: EvenementDate[],
  dossiers: SanctionDate[],
  recus: RecuDate[],
  D: Date
): SituationADate {
  const t = D.getTime();
  const annee = D.getUTCFullYear();
  const tries = [...evenements].sort((a, b) => a.dateEffet.getTime() - b.dateEffet.getTime());
  const dernier = tries.filter((e) => e.dateEffet.getTime() <= t && e.statutApres).pop();
  const suivant = tries.find((e) => e.dateEffet.getTime() > t && e.statutAvant);
  let statut: StatutMembre | null = dernier?.statutApres ?? suivant?.statutAvant ?? membre.statut;
  if (membre.dateInscription && membre.dateInscription.getTime() > t) statut = null;

  const couvre = (s: SanctionDate) => !!s.sanctionDebut && s.sanctionDebut.getTime() <= t && (!s.sanctionFin || t <= s.sanctionFin.getTime());
  const interdictions = dossiers.filter(couvre);
  if (statut === "INSCRIT" && interdictions.some((s) => !s.sursis)) statut = "SUSPENDU";
  const sursis = interdictions.some((s) => s.sursis);
  const ineligible = dossiers.some((s) => {
    const debut = s.dateDecision ?? s.sanctionDebut;
    return !!s.peineAccessoireMois && !!debut && debut.getTime() <= t && t < ajouterMois(debut, s.peineAccessoireMois).getTime();
  });

  const recusCot = recus.filter((r) => r.annee === annee && !estRecuDroit(r.objet));
  const ligne = membre.cotisations?.find((c) => c.annee === annee);
  const paye = recusCot.length
    ? recusCot.filter((r) => r.date.getTime() <= t).reduce((s, r) => s + r.montant, 0)
    : ligne?.datePaiement && ligne.datePaiement.getTime() <= t ? ligne.montantPaye : 0;
  return { statut, sursis, ineligible, annee, cotisation: ligne ? { montantDu: ligne.montantDu, montantPaye: paye } : null };
}

// ─── Corps électoral à une date (X-03, D10) ──────────────────────────────────

/** Fin de journée UTC : la date du scrutin inclut les paiements et actes du jour. */
export const finDeJourUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

/** Date de référence du corps électoral d'un scrutin : dateScrutin, sinon ouverture, sinon aujourd'hui. */
export const dateReferenceScrutin = (s: { dateScrutin: Date | null; ouvertLe: Date | null }) =>
  finDeJourUTC(s.dateScrutin ?? s.ouvertLe ?? new Date());

/**
 * Membres filtrés par `where`, avec leur situation à D (événements, sanctions, reçus de
 * l'exercice chargés en quatre requêtes) et leur qualité d'électeur selon les règles
 * en vigueur. Un membre inscrit après D (statut null) est exclu pour « statut ».
 */
export async function electeursADate(where: Prisma.MembreWhereInput, D: Date, regles?: Regles) {
  const annee = D.getUTCFullYear();
  const [membres, tarifs, r] = await Promise.all([
    prisma.membre.findMany({
      where,
      orderBy: { num: "asc" },
      include: {
        cotisations: { where: { annee } },
        recus: { where: { annee }, select: { annee: true, montant: true, date: true, objet: true } },
        evenements: { select: { dateEffet: true, statutAvant: true, statutApres: true } },
        dossiers: {
          where: { sanctionCode: { not: null } },
          select: { sursis: true, sanctionDebut: true, sanctionFin: true, peineAccessoireMois: true, dateDecision: true },
        },
      },
    }),
    tarifsActuels(),
    regles ?? reglesActuelles(),
  ]);
  return membres.map((m) => {
    const situation = situationADate(m, m.evenements, m.dossiers, m.recus, D);
    const { eligible, raison } = situation.statut
      ? eligibiliteElectorale({ qualite: m.qualite, statut: situation.statut }, situation.cotisation, tarifs, r)
      : { eligible: false, raison: "statut" };
    return { membre: m, situation, eligible, raison };
  });
}
