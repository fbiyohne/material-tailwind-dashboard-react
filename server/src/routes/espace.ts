import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireAvocat, type AuthRequest } from "../middleware/auth.js";
import { montantDuAvec, droitDuAvec, statutCotisation, tarifsActuels } from "../lib/business.js";
import { finaliserPaiement } from "../lib/encaissement.js";
import { CANAUX, modeSandbox, nouvelleReference, initierPaiement } from "../lib/paiement.js";
import { htmlVersPdf } from "../lib/pdf.js";
import { recuHtml, quitusHtml } from "../lib/templates.js";
import { signerDocument, quitusPayload } from "../lib/signature.js";

/**
 * Espace avocat — surface en libre-service, strictement cloisonnée.
 * Toutes les routes exigent le rôle AVOCAT et dérivent le `membreId` DU JETON
 * (jamais d'un paramètre client) : un avocat ne peut consulter que ses propres
 * données. Le middleware global `confinementAvocat` interdit par ailleurs à ce
 * rôle toute route hors de cet espace.
 */
export const espaceRouter = Router();
espaceRouter.use(requireAuth, requireAvocat);

/** Identifiant de la fiche de l'avocat connecté (garanti par requireAvocat). */
const monMembreId = (req: AuthRequest) => req.user!.membreId as number;

const dateCourte = (v: Date | null | undefined) => (v ? v.toISOString().slice(0, 10) : null);

/**
 * GET /espace/moi — fiche de l'avocat connecté et synthèse de sa situation
 * (cotisation et droit de plaidoirie de l'exercice courant) + historiques.
 */
espaceRouter.get(
  "/moi",
  asyncH(async (req: AuthRequest, res) => {
    const id = monMembreId(req);
    const annee = new Date().getFullYear();
    const [membre, tarifs] = await Promise.all([
      prisma.membre.findUnique({
        where: { id },
        include: {
          cotisations: { orderBy: { annee: "desc" } },
          droitsPlaidoirie: { orderBy: { annee: "desc" } },
        },
      }),
      tarifsActuels(),
    ]);
    if (!membre) throw new HttpError(404, "Fiche introuvable");

    const cot = membre.cotisations.find((c) => c.annee === annee);
    const cotDu = cot?.montantDu ?? montantDuAvec(tarifs, membre.qualite);
    const cotPaye = cot?.montantPaye ?? 0;
    const droit = membre.droitsPlaidoirie.find((d) => d.annee === annee);
    const estAvocat = membre.qualite === "AVOCAT";
    const droitDu = estAvocat ? droit?.montantDu ?? droitDuAvec(tarifs, membre.qualite) : 0;
    const droitPaye = droit?.montantPaye ?? 0;

    res.json({
      membre: {
        id: membre.id,
        num: membre.num,
        numInscription: membre.numInscription,
        nom: membre.nom,
        qualite: membre.qualite.toLowerCase(),
        statut: membre.statut.toLowerCase(),
        cabinet: membre.cabinet,
        tel: membre.tel,
        email: membre.email,
        adresse: membre.adresse,
        dateInscription: dateCourte(membre.dateInscription),
      },
      annee,
      situation: {
        cotisation: { du: cotDu, paye: cotPaye, solde: Math.max(0, cotDu - cotPaye), valideTresoriere: cot?.valideTresoriere ?? false, statut: statutCotisation(cotDu, cotPaye) },
        droit: estAvocat ? { du: droitDu, paye: droitPaye, solde: Math.max(0, droitDu - droitPaye), statut: statutCotisation(droitDu, droitPaye) } : null,
      },
      cotisations: membre.cotisations.map((c) => ({ annee: c.annee, du: c.montantDu, paye: c.montantPaye, datePaiement: dateCourte(c.datePaiement), valideTresoriere: c.valideTresoriere, statut: statutCotisation(c.montantDu, c.montantPaye) })),
      droits: membre.droitsPlaidoirie.map((d) => ({ annee: d.annee, du: d.montantDu, paye: d.montantPaye, datePaiement: dateCourte(d.datePaiement), statut: statutCotisation(d.montantDu, d.montantPaye) })),
    });
  })
);

/** GET /espace/documents — reçus et quitus délivrés à l'avocat connecté. */
espaceRouter.get(
  "/documents",
  asyncH(async (req: AuthRequest, res) => {
    const membreId = monMembreId(req);
    const [recus, quitus] = await Promise.all([
      prisma.recu.findMany({ where: { membreId }, orderBy: { date: "desc" } }),
      prisma.quitus.findMany({ where: { membreId }, orderBy: { dateEmission: "desc" } }),
    ]);
    res.json({
      recus: recus.map((r) => ({ id: r.id, numero: r.numero, montant: r.montant, annee: r.annee, date: dateCourte(r.date), objet: r.objet })),
      quitus: quitus.map((q) => ({ id: q.id, numero: q.numero, annee: q.annee, date: dateCourte(q.dateEmission) })),
    });
  })
);

// ── Paiement en ligne de SA propre situation (phase 2) ──────────────────────

/** Solde restant dû de l'avocat connecté pour un type/exercice donné. */
async function soldeDe(membreId: number, type: "cotisation" | "droit", annee: number) {
  const membre = await prisma.membre.findUnique({ where: { id: membreId } });
  if (!membre) throw new HttpError(404, "Fiche introuvable");
  const tarifs = await tarifsActuels();
  if (type === "droit" && membre.qualite !== "AVOCAT") {
    throw new HttpError(400, "Le droit de plaidoirie ne concerne que les avocats inscrits.");
  }
  if (type === "droit") {
    const d = await prisma.droitPlaidoirie.findUnique({ where: { membreId_annee: { membreId, annee } } });
    const du = d?.montantDu ?? droitDuAvec(tarifs, membre.qualite);
    return { membre, du, paye: d?.montantPaye ?? 0, solde: Math.max(0, du - (d?.montantPaye ?? 0)) };
  }
  const c = await prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } } });
  const du = c?.montantDu ?? montantDuAvec(tarifs, membre.qualite);
  return { membre, du, paye: c?.montantPaye ?? 0, solde: Math.max(0, du - (c?.montantPaye ?? 0)) };
}

const paiementSchema = z.object({
  annee: z.number().int(),
  type: z.enum(["cotisation", "droit"]),
  canal: z.enum(CANAUX),
  montant: z.number().int().positive().optional(),
});

/**
 * POST /espace/paiement — l'avocat initie le paiement en ligne de SA situation.
 * Le `membreId` provient du jeton ; le montant est plafonné au solde restant dû.
 */
espaceRouter.post(
  "/paiement",
  asyncH(async (req: AuthRequest, res) => {
    const membreId = monMembreId(req);
    const { annee, type, canal, montant } = paiementSchema.parse(req.body);
    const { membre, solde } = await soldeDe(membreId, type, annee);
    if (solde <= 0) throw new HttpError(400, "Aucun solde à régler pour cet exercice.");
    const aPayer = montant ?? solde;
    if (aPayer > solde) throw new HttpError(400, `Montant supérieur au solde dû (${solde} FCFA).`);

    const ref = nouvelleReference();
    const passerelle = await initierPaiement({ ref, canal, montant: aPayer, tel: membre.tel ?? undefined });
    const paiement = await prisma.paiement.create({
      data: { ref, canal, type, membreId, annee, montant: aPayer, statut: "EN_ATTENTE" },
    });
    res.status(201).json({ paiement, sandbox: modeSandbox, ...passerelle });
  })
);

const confirmerSchema = z.object({ succes: z.boolean().default(true) });

/**
 * POST /espace/paiement/:ref/confirmer-sandbox — simule le retour passerelle
 * (sandbox). Strictement limité au paiement de l'avocat connecté.
 */
espaceRouter.post(
  "/paiement/:ref/confirmer-sandbox",
  asyncH(async (req: AuthRequest, res) => {
    if (!modeSandbox) throw new HttpError(400, "Indisponible : une passerelle réelle est configurée.");
    const { succes } = confirmerSchema.parse(req.body ?? {});
    const p = await prisma.paiement.findUnique({ where: { ref: req.params.ref } });
    if (!p || p.membreId !== monMembreId(req)) throw new HttpError(404, "Paiement introuvable");
    if (succes) return res.json(await finaliserPaiement(p.id));
    res.json(await prisma.paiement.update({ where: { id: p.id }, data: { statut: "ECHEC" } }));
  })
);

/** GET /espace/recus/:id/pdf — reçu officiel de l'avocat connecté (cloisonné). */
espaceRouter.get(
  "/recus/:id/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const recu = await prisma.recu.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!recu || recu.membreId !== monMembreId(req)) throw new HttpError(404, "Reçu introuvable");
    const pdf = await htmlVersPdf(recuHtml(recu, recu.membre));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Recu-${recu.numero}.pdf"`);
    res.end(pdf);
  })
);

/** GET /espace/quitus/:id/pdf — quitus officiel signé de l'avocat connecté (cloisonné). */
espaceRouter.get(
  "/quitus/:id/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!quitus || quitus.membreId !== monMembreId(req)) throw new HttpError(404, "Quitus introuvable");
    const signature = signerDocument(quitusPayload(quitus));
    const pdf = await htmlVersPdf(quitusHtml(quitus, quitus.membre, signature));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Quitus-${quitus.numero}.pdf"`);
    res.end(pdf);
  })
);
