import { Prisma, type Membre } from "@prisma/client";
import { prisma } from "../prisma.js";
import { HttpError } from "../middleware/error.js";
import { montantDuAvec, droitDuAvec, prochainNumeroRecu, tarifsActuels } from "./business.js";
import { envoyerEmail } from "./notifications.js";

export type TypeReglement = "cotisation" | "droit";

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
}) {
  const { membre, annee, montant, type } = opts;
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
  let resultat;
  for (let tentative = 1; ; tentative++) {
    const numero = await prochainNumeroRecu(annee);
    try {
      resultat = await prisma.$transaction(async (tx) => {
        const situation = estDroit
          ? await tx.droitPlaidoirie.upsert({
              where: { membreId_annee: { membreId: membre.id, annee } },
              create: { membreId: membre.id, annee, montantDu: droitDuAvec(tarifs, membre.qualite), montantPaye: montant, datePaiement: dateP, mode, ref },
              update: { montantPaye: { increment: montant }, datePaiement: dateP, mode, ref },
            })
          : await tx.cotisation.upsert({
              where: { membreId_annee: { membreId: membre.id, annee } },
              create: { membreId: membre.id, annee, montantDu: montantDuAvec(tarifs, membre.qualite), montantPaye: montant, datePaiement: dateP, mode, ref },
              update: { montantPaye: { increment: montant }, datePaiement: dateP, mode, ref },
            });
        const recu = await tx.recu.create({ data: { numero, membreId: membre.id, montant, annee, date: dateP, mode, ref, objet } });
        await tx.archive.create({ data: { categorie: "Reçu de paiement", titre: `Reçu N° ${numero} — Me ${membre.nom}`, reference: numero, date: dateP, membreNom: membre.nom } });
        return estDroit ? { droit: situation, recu } : { cotisation: situation, recu };
      });
      break;
    } catch (e) {
      const collisionNumero =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && tentative < MAX_TENTATIVES;
      if (!collisionNumero) throw e;
    }
  }

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
  if (p.statut === "REUSSI" && p.recuNumero) return p; // déjà encaissé
  const { recu } = await encaisser({
    membre: p.membre, annee: p.annee, montant: p.montant,
    type: p.type as TypeReglement, mode: `En ligne (${p.canal})`, ref: p.ref,
  });
  return prisma.paiement.update({ where: { id: p.id }, data: { statut: "REUSSI", recuNumero: recu.numero } });
}
