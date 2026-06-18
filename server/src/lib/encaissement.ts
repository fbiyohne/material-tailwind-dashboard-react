import { Prisma, type Membre } from "@prisma/client";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { montantDuAvec, droitDuAvec, prochainNumeroRecu, tarifsActuels } from "./business.js";
import { envoyerEmail } from "./notifications.js";

export type TypeReglement = "cotisation" | "droit";

/**
 * Garde de versement manuel : refuse un paiement sur un solde déjà nul (409) ou
 * supérieur au solde restant dû (400). Message clair en amont — la garde ATOMIQUE
 * équivalente dans `encaisser` couvre, elle, la concurrence (TOCTOU).
 */
export function gardeVersement(du: number, dejaPaye: number, montant: number, messageSolde: string): void {
  const restant = du - dejaPaye;
  if (du > 0 && restant <= 0) throw new HttpError(409, messageSolde);
  if (montant > restant) throw new HttpError(400, `Le versement dépasse le solde restant dû (${restant.toLocaleString("fr-FR")} FCFA).`);
}

/**
 * Encaissement unifié (BR-03) : enregistre un règlement, met à jour la
 * situation (cotisation ou droit de plaidoirie), émet le reçu, l'archive
 * (RG-14) et notifie l'avocat. Partagé par le paiement manuel et le paiement
 * en ligne (passerelle), pour une logique unique et cohérente.
 */
export async function encaisser(opts: {
  membre: Membre;
  annee: number;
  montant: number;
  type: TypeReglement;
  mode?: string | null;
  ref?: string | null;
  date?: Date;
  /** Paiement passerelle à finaliser ATOMIQUEMENT dans la même transaction. */
  paiementId?: number | null;
}) {
  const { membre, annee, montant, type, paiementId } = opts;
  const dateP = opts.date ?? new Date();
  const mode = opts.mode ?? undefined;
  const ref = opts.ref ?? undefined;
  const estDroit = type === "droit";
  const tarifs = await tarifsActuels();
  const objet = estDroit ? `Droit de plaidoirie ${annee}` : `Cotisation ordinale ${annee}`;

  // Numérotation atomique (RG-10 / BR-03) : le numéro est calculé puis consommé
  // dans la même tentative. En cas de course (deux encaissements simultanés sur
  // le même exercice), la contrainte @unique(Recu.numero) rejette le doublon et
  // l'on rejoue la transaction — le numéro est recalculé à partir des lignes déjà
  // committées, jamais perdu.
  const MAX_TENTATIVES = 5;
  let resultat: { cotisation?: unknown; droit?: unknown; recu: { numero: string } } | null = null;
  for (let tentative = 1; ; tentative++) {
    const numero = await prochainNumeroRecu(annee);
    try {
      resultat = await prisma.$transaction(async (tx) => {
        // Finalisation passerelle DANS la même transaction que l'encaissement :
        // réclamation atomique du paiement (statut → REUSSI) AVANT tout incrément.
        // Le perdant d'une course (rejeu de webhook, double-clic) voit count 0 et
        // n'encaisse pas → ni double crédit, ni état REUSSI-sans-reçu intermédiaire.
        if (paiementId != null) {
          const claim = await tx.paiement.updateMany({
            where: { id: paiementId, statut: { in: ["INITIE", "EN_ATTENTE"] } },
            data: { statut: "REUSSI" },
          });
          if (claim.count === 0) return null;
        }
        let situation;
        let montantPaye: number;
        let montantDu: number;
        if (estDroit) {
          const d = await tx.droitPlaidoirie.upsert({
            where: { membreId_annee: { membreId: membre.id, annee } },
            create: { membreId: membre.id, annee, montantDu: droitDuAvec(tarifs, membre.qualite), montantPaye: montant, datePaiement: dateP, mode, ref },
            update: { montantPaye: { increment: montant }, datePaiement: dateP, mode, ref },
          });
          situation = d;
          montantPaye = d.montantPaye;
          montantDu = d.montantDu;
        } else {
          const cot = await tx.cotisation.upsert({
            where: { membreId_annee: { membreId: membre.id, annee } },
            create: { membreId: membre.id, annee, montantDu: montantDuAvec(tarifs, membre.qualite), montantPaye: montant, datePaiement: dateP, mode, ref },
            update: { montantPaye: { increment: montant }, datePaiement: dateP, mode, ref },
          });
          montantPaye = cot.montantPaye;
          montantDu = cot.montantDu;
          // Règlement intégral = validation Trésorière (BR-01) : dès que la
          // cotisation est soldée, l'avocat est marqué « validé » et devient
          // immédiatement éligible au quitus — le reçu officiel émis fait foi,
          // sans seconde action manuelle. Un solde partiel reste « à valider ».
          situation = cot.montantPaye >= cot.montantDu && cot.montantPaye > 0 && !cot.valideTresoriere
            ? await tx.cotisation.update({ where: { membreId_annee: { membreId: membre.id, annee } }, data: { valideTresoriere: true } })
            : cot;
        }
        // Garde anti-surpaiement ATOMIQUE : l'incrément et cette vérification sont
        // dans la même transaction sérialisée par le verrou de ligne — ferme la
        // fenêtre TOCTOU des gardes de route (deux versements concurrents ne
        // peuvent plus faire dépasser le montant dû).
        if (montantDu > 0 && montantPaye > montantDu) {
          throw new HttpError(400, "Le versement dépasse le solde restant dû.");
        }
        const recu = await tx.recu.create({ data: { numero, membreId: membre.id, montant, annee, date: dateP, mode, ref, objet } });
        await tx.archive.create({ data: { categorie: "Reçu de paiement", titre: `Reçu N° ${numero} — Me ${membre.nom}`, reference: numero, date: dateP, membreNom: membre.nom } });
        // Reçu lié au paiement dans la MÊME transaction : statut REUSSI et
        // recuNumero sont committés ensemble (jamais REUSSI sans reçu).
        if (paiementId != null) {
          await tx.paiement.update({ where: { id: paiementId }, data: { recuNumero: numero } });
        }
        return estDroit ? { droit: situation, recu } : { cotisation: situation, recu };
      });
      break;
    } catch (e) {
      const collisionNumero =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < MAX_TENTATIVES;
      if (!collisionNumero) throw e;
    }
  }

  // Paiement déjà finalisé par un appel concurrent : rien n'a été encaissé.
  if (!resultat) return null;

  const numero = resultat.recu.numero;
  if (membre.email) {
    void envoyerEmail({
      to: membre.email,
      subject: `Reçu N° ${numero} — ${estDroit ? "droit de plaidoirie" : "cotisation"} ${annee} · Barreau de Pointe-Noire`,
      text: `Maître ${membre.nom},\n\nNous accusons réception de votre versement de ${montant.toLocaleString("fr-FR")} FCFA au titre ${estDroit ? "du droit de plaidoirie" : "de la cotisation ordinale"} ${annee}.\nVotre reçu officiel N° ${numero} a été établi.\n\nLe Secrétariat Général du Barreau de Pointe-Noire.`,
      evenement: "RECU",
    });
  }
  return resultat;
}

/**
 * Finalise un paiement passerelle réussi : encaisse (BR-03), émet le reçu et
 * marque le paiement REUSSI. Idempotent (recuNumero). Partagé par le webhook,
 * la simulation sandbox et l'espace avocat.
 */
export async function finaliserPaiement(paiementId: number) {
  const p = await prisma.paiement.findUnique({ where: { id: paiementId }, include: { membre: true } });
  if (!p) throw new HttpError(404, "Paiement introuvable");
  if (p.statut === "REUSSI" && p.recuNumero) return p; // déjà encaissé (idempotent)

  // L'encaissement réclame le paiement ET pose statut + recuNumero DANS sa propre
  // transaction (atomique) : aucune fenêtre de double-crédit ni d'état incohérent
  // « REUSSI sans reçu ». En cas d'échec, la transaction est annulée intégralement,
  // le paiement reste réclamable et un rejeu réessaie proprement.
  await encaisser({
    membre: p.membre, annee: p.annee, montant: p.montant,
    type: p.type as TypeReglement, mode: `En ligne (${p.canal})`, ref: p.ref,
    paiementId: p.id,
  });
  return (await prisma.paiement.findUnique({ where: { id: paiementId } }))!;
}
