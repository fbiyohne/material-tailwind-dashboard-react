import type { Membre } from "@prisma/client";
import { prisma } from "../prisma.js";
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
  const numero = await prochainNumeroRecu(annee);
  const objet = estDroit ? `Droit de plaidoirie ${annee}` : `Cotisation ordinale ${annee}`;

  const resultat = await prisma.$transaction(async (tx) => {
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
