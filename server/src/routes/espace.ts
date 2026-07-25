import { Router } from "express";
import { z } from "zod";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { requireAuth, requireAvocat, type AuthRequest } from "../middleware/auth.js";
import { enregistrerFichier, lireFichier, supprimerFichier } from "../lib/storage.js";
import { cotisationDue, droitDue, statutCotisation, tarifsActuels, eligibiliteElectorale, prochainNumeroAttestation, archiver } from "../lib/business.js";
import { finaliserPaiement } from "../lib/encaissement.js";
import { CANAUX, modeSandbox, nouvelleReference, initierPaiement } from "../lib/paiement.js";
import QRCode from "qrcode";
import { envoyerPdf, envoyerDocumentPdf } from "../lib/pdf.js";
import { convocationAgHtml, pvAssembleeHtml, decisionDisciplineHtml, attestationHtml, attestationNonRedevanceHtml } from "../lib/templates.js";
import { recuRicheHtml, quitusRicheHtml } from "../lib/documentsRiches.js";
import { notifierNouveauMessage, emailsAdministration, emailsMembres } from "../lib/messagerieNotif.js";
import { messageNonDeMoi, compterNonLusParFil, totalNonLus, jamaisLu } from "../lib/messagerie.js";
import { realtimeMembres, realtimeAdministration } from "../lib/realtime.js";
import { notifier, usersSecretariat, listerNotifications, compterNonLus, marquerLu, marquerToutLu } from "../lib/centreNotifications.js";

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
    const cotDu = cotisationDue(cot, tarifs, membre.qualite);
    const cotPaye = cot?.montantPaye ?? 0;
    const droit = membre.droitsPlaidoirie.find((d) => d.annee === annee);
    const estAvocat = membre.qualite === "AVOCAT";
    const droitDu = estAvocat ? droitDue(droit, tarifs, membre.qualite) : 0;
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

/**
 * PATCH /espace/moi — l'avocat met à jour SES coordonnées de contact (téléphone,
 * email de contact, adresse). Bornée à ces champs : ni le nom, ni la qualité, ni le
 * statut, ni l'email de connexion (compte User) ne sont modifiables ici.
 */
const coordonneesSchema = z.object({
  tel: z.string().trim().max(40).optional(),
  email: z.string().trim().email().max(160).or(z.literal("")).optional(),
  adresse: z.string().trim().max(300).optional(),
});
espaceRouter.patch(
  "/moi",
  asyncH(async (req: AuthRequest, res) => {
    const data = coordonneesSchema.parse(req.body);
    const membre = await prisma.membre.update({
      where: { id: monMembreId(req) },
      data: {
        tel: data.tel,
        email: data.email === "" ? null : data.email,
        adresse: data.adresse,
      },
      select: { tel: true, email: true, adresse: true },
    });
    res.json(membre);
  })
);

/**
 * GET /espace/attestation/inscription/pdf — l'avocat édite lui-même son
 * attestation d'inscription (self-service, FR-AV-05). Numérotée et archivée comme
 * l'émission par le Secrétariat, avec traçabilité au nom de l'intéressé.
 */
espaceRouter.get(
  "/attestation/inscription/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: monMembreId(req) } });
    if (!membre) throw new HttpError(404, "Fiche introuvable");
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation d'inscription", titre: `Attestation ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationHtml(membre, numero, date), `Attestation-${numero}.pdf`);
  })
);

/**
 * GET /espace/attestation/non-redevance/pdf — attestation de non-redevance, éditée
 * en self-service uniquement si la cotisation de l'exercice courant est soldée
 * (sinon 409 : l'avocat doit d'abord régulariser sa situation).
 */
espaceRouter.get(
  "/attestation/non-redevance/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const membre = await prisma.membre.findUnique({ where: { id: monMembreId(req) } });
    if (!membre) throw new HttpError(404, "Fiche introuvable");
    const annee = new Date().getFullYear();
    const [tarifs, cot] = await Promise.all([
      tarifsActuels(),
      prisma.cotisation.findUnique({ where: { membreId_annee: { membreId: membre.id, annee } } }),
    ]);
    const solde = cotisationDue(cot, tarifs, membre.qualite) - (cot?.montantPaye ?? 0);
    if (solde > 0) throw new HttpError(409, "Attestation indisponible : votre cotisation de l'exercice n'est pas soldée.");
    const numero = await prochainNumeroAttestation();
    const date = new Date();
    await archiver({ categorie: "Attestation de non-redevance", titre: `Attestation de non-redevance ${numero} — Me ${membre.nom}`, reference: numero, date, membreNom: membre.nom });
    await envoyerPdf(res, attestationNonRedevanceHtml(membre, numero, annee, date), `Attestation-non-redevance-${numero}.pdf`);
  })
);

// — Centre de notifications de l'avocat (mêmes helpers que le back-office) —

/** GET /espace/notifications — dernières alertes de l'avocat + compteur non-lues. */
espaceRouter.get(
  "/notifications",
  asyncH(async (req: AuthRequest, res) => {
    const userId = req.user!.id;
    const [items, nonLus] = await Promise.all([listerNotifications(userId), compterNonLus(userId)]);
    res.json({ items, nonLus });
  })
);

/** POST /espace/notifications/lu-tout — marque toutes mes alertes comme lues. */
espaceRouter.post(
  "/notifications/lu-tout",
  asyncH(async (req: AuthRequest, res) => {
    const n = await marquerToutLu(req.user!.id);
    res.json({ ok: true, marquees: n });
  })
);

/** POST /espace/notifications/:id/lu — marque une de mes alertes comme lue. */
espaceRouter.post(
  "/notifications/:id/lu",
  asyncH(async (req: AuthRequest, res) => {
    const ok = await marquerLu(req.user!.id, Number(req.params.id));
    if (!ok) throw new HttpError(404, "Notification introuvable");
    res.json({ ok: true });
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
    const du = droitDue(d, tarifs, membre.qualite);
    return { membre, du, paye: d?.montantPaye ?? 0, solde: Math.max(0, du - (d?.montantPaye ?? 0)) };
  }
  const c = await prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee } } });
  const du = cotisationDue(c, tarifs, membre.qualite);
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
    const host = req.get("host") ?? "";
    const proto = req.get("x-forwarded-proto") ?? req.protocol;
    const qr = await QRCode.toDataURL(`${proto}://${host}/verifier/recu/${recu.numero}`, { margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
    await envoyerDocumentPdf(res, recuRicheHtml(recu, recu.membre, qr, host), `Recu-${recu.numero}.pdf`);
  })
);

/** GET /espace/quitus/:id/pdf — quitus officiel signé de l'avocat connecté (cloisonné). */
espaceRouter.get(
  "/quitus/:id/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const quitus = await prisma.quitus.findUnique({ where: { id: Number(req.params.id) }, include: { membre: true } });
    if (!quitus || quitus.membreId !== monMembreId(req)) throw new HttpError(404, "Quitus introuvable");
    const host = req.get("host") ?? "";
    const proto = req.get("x-forwarded-proto") ?? req.protocol;
    const qr = await QRCode.toDataURL(`${proto}://${host}/verifier/quitus/${quitus.numero}`, { margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
    await envoyerDocumentPdf(res, quitusRicheHtml(quitus, quitus.membre, qr, host), `Quitus-${quitus.numero}.pdf`);
  })
);

// ── Annuaire des confrères (lecture seule) ──────────────────────────────────

/**
 * GET /espace/annuaire — annuaire du Barreau accessible à tout membre.
 * Projection professionnelle (nom, cabinet, coordonnées) pour permettre à un
 * avocat de joindre un confrère ; aucune donnée personnelle sensible (adresse,
 * RCCM, CNSS, finances…) n'est exposée.
 */
espaceRouter.get(
  "/annuaire",
  asyncH(async (req: AuthRequest, res) => {
    const q = String(req.query.q ?? "").trim();
    const membres = await prisma.membre.findMany({
      // Annuaire des confrères : on exclut sa propre fiche.
      where: {
        id: { not: monMembreId(req) },
        ...(q ? { OR: [{ nom: { contains: q, mode: "insensitive" } }, { cabinet: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { nom: "asc" },
      select: {
        id: true, num: true, numInscription: true, nom: true, qualite: true,
        statut: true, cabinet: true, tel: true, email: true, dateInscription: true,
      },
    });
    res.json(membres.map((m) => ({ ...m, dateInscription: dateCourte(m.dateInscription) })));
  })
);

// ── Assemblées générales (lecture seule — concernent tous les membres) ───────

/** GET /espace/assemblees — liste des assemblées générales (convocations, PV). */
espaceRouter.get(
  "/assemblees",
  asyncH(async (_req, res) => {
    res.json(await prisma.assemblee.findMany({ orderBy: { date: "desc" } }));
  })
);

/** GET /espace/assemblees/:id — détail d'une assemblée générale. */
espaceRouter.get(
  "/assemblees/:id",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    res.json(a);
  })
);

/** GET /espace/assemblees/:id/convocation/pdf — convocation d'AG (PDF). */
espaceRouter.get(
  "/assemblees/:id/convocation/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    const jour = new Date(a.date).toISOString().slice(0, 10);
    await envoyerPdf(res, convocationAgHtml(a), `Convocation-${a.type}-${jour}.pdf`);
  })
);

/** GET /espace/assemblees/:id/pv/pdf — procès-verbal d'AG (PDF), si disponible. */
espaceRouter.get(
  "/assemblees/:id/pv/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const a = await prisma.assemblee.findUnique({ where: { id: Number(req.params.id) } });
    if (!a) throw new HttpError(404, "Assemblée introuvable");
    if (!a.pv) throw new HttpError(404, "Procès-verbal non disponible");
    const jour = new Date(a.date).toISOString().slice(0, 10);
    await envoyerPdf(res, pvAssembleeHtml(a), `PV-${a.type}-${jour}.pdf`);
  })
);

// ── Discipline — strictement les dossiers concernant l'avocat connecté ───────

/** GET /espace/discipline — dossiers disciplinaires où l'avocat est mis en cause. */
espaceRouter.get(
  "/discipline",
  asyncH(async (req: AuthRequest, res) => {
    res.json(
      await prisma.dossierDisciplinaire.findMany({
        where: { membreId: monMembreId(req) },
        orderBy: { id: "desc" },
      })
    );
  })
);

/** GET /espace/discipline/:id — détail d'un dossier le concernant. */
espaceRouter.get(
  "/discipline/:id",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d || d.membreId !== monMembreId(req)) throw new HttpError(404, "Dossier introuvable");
    res.json(d);
  })
);

/** GET /espace/discipline/:id/decision/pdf — décision rendue, si disponible. */
espaceRouter.get(
  "/discipline/:id/decision/pdf",
  asyncH(async (req: AuthRequest, res) => {
    const d = await prisma.dossierDisciplinaire.findUnique({ where: { id: Number(req.params.id) } });
    if (!d || d.membreId !== monMembreId(req)) throw new HttpError(404, "Dossier introuvable");
    if (!d.decision) throw new HttpError(404, "Décision non disponible");
    await envoyerPdf(res, decisionDisciplineHtml(d), `Decision-${d.reference}.pdf`);
  })
);

// ── Pièces justificatives soumises par l'avocat (vérification KYC) ───────────
const TYPES_PIECE_ESPACE = ["IDENTITE", "DIPLOME", "SERMENT", "PHOTO", "CASIER", "AUTRE"] as const;
const MAX_TAILLE_PIECE = 5 * 1024 * 1024; // 5 Mo
const pieceEspaceSchema = z.object({
  type: z.enum(TYPES_PIECE_ESPACE),
  nomFichier: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  donnees: z.string().min(1), // base64 sans préfixe data:
});
const INLINE_SUR_PIECE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"]);

/** GET /espace/pieces — pièces soumises par l'avocat + statut de vérification. */
espaceRouter.get(
  "/pieces",
  asyncH(async (req: AuthRequest, res) => {
    const pieces = await prisma.pieceDossier.findMany({
      where: { membreId: monMembreId(req) },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, nomFichier: true, mimeType: true, taille: true, statut: true, note: true, createdAt: true },
    });
    res.json(pieces);
  })
);

/** POST /espace/pieces — l'avocat soumet une pièce pour SON propre dossier. */
espaceRouter.post(
  "/pieces",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const data = pieceEspaceSchema.parse(req.body);
    const tailleEstimee = Math.floor((data.donnees.length * 3) / 4);
    if (tailleEstimee > MAX_TAILLE_PIECE) throw new HttpError(413, "Fichier trop volumineux (max 5 Mo).");
    const ext = path.extname(data.nomFichier).slice(0, 12);
    const { chemin, taille } = enregistrerFichier(`pieces/${moi}`, data.donnees, ext);
    const piece = await prisma.pieceDossier.create({
      data: { membreId: moi, type: data.type, nomFichier: data.nomFichier, fichier: chemin, mimeType: data.mimeType, taille },
    });
    // Alerte le Secrétariat qu'une pièce attend vérification (best-effort).
    const fiche = await prisma.membre.findUnique({ where: { id: moi }, select: { nom: true } });
    void usersSecretariat()
      .then((ids) => notifier(ids, { type: "PIECE_SOUMISE", titre: "Pièce à vérifier", message: `Me ${fiche?.nom ?? "un avocat"} a soumis une pièce (${data.type}).`, lien: `/avocats/${moi}` }))
      .catch(() => {});
    res.status(201).json({ id: piece.id, type: piece.type, nomFichier: piece.nomFichier, statut: piece.statut, createdAt: piece.createdAt });
  })
);

/** GET /espace/pieces/:id/fichier — l'avocat consulte UNE de SES pièces. */
espaceRouter.get(
  "/pieces/:id/fichier",
  asyncH(async (req: AuthRequest, res) => {
    const piece = await prisma.pieceDossier.findUnique({ where: { id: Number(req.params.id) } });
    if (!piece || piece.membreId !== monMembreId(req)) throw new HttpError(404, "Pièce introuvable");
    const buffer = lireFichier(piece.fichier);
    const sur = INLINE_SUR_PIECE.has(piece.mimeType ?? "");
    const nom = piece.nomFichier.replace(/[\r\n"]/g, "");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", sur ? piece.mimeType! : "application/octet-stream");
    res.setHeader("Content-Disposition", `${sur ? "inline" : "attachment"}; filename="${nom}"`);
    res.end(buffer);
  })
);

/** DELETE /espace/pieces/:id — retrait d'une pièce encore en attente (pas déjà vérifiée). */
espaceRouter.delete(
  "/pieces/:id",
  asyncH(async (req: AuthRequest, res) => {
    const piece = await prisma.pieceDossier.findUnique({ where: { id: Number(req.params.id) } });
    if (!piece || piece.membreId !== monMembreId(req)) throw new HttpError(404, "Pièce introuvable");
    if (piece.statut === "VERIFIEE") throw new HttpError(409, "Une pièce déjà vérifiée ne peut pas être retirée.");
    try { supprimerFichier(piece.fichier); } catch { /* fichier déjà absent */ }
    await prisma.pieceDossier.delete({ where: { id: piece.id } });
    res.status(204).end();
  })
);

// ── Archives officielles (institutionnelles + concernant l'avocat) ──────────

/** Catégories d'archives confidentielles, jamais exposées dans l'espace avocat. */
const ARCHIVES_EXCLUES = ["Convocation disciplinaire", "Décision disciplinaire"];

/**
 * GET /espace/archives — registre des documents officiels consultables par
 * l'avocat : pièces institutionnelles (membreNom nul) et documents le concernant
 * (son propre nom). Les pièces disciplinaires nominatives en sont exclues.
 */
espaceRouter.get(
  "/archives",
  asyncH(async (req: AuthRequest, res) => {
    const moi = await prisma.membre.findUnique({ where: { id: monMembreId(req) }, select: { nom: true } });
    const q = String(req.query.q ?? "").trim();
    const where: Prisma.ArchiveWhereInput = {
      categorie: { notIn: ARCHIVES_EXCLUES },
      OR: [{ membreNom: null }, { membreNom: "" }, ...(moi?.nom ? [{ membreNom: moi.nom }] : [])],
      ...(q
        ? { AND: [{ OR: [{ titre: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }] }] }
        : {}),
    };
    const archives = await prisma.archive.findMany({ where, orderBy: { archiveLe: "desc" }, take: 300 });
    const categories = [...new Set(archives.map((a) => a.categorie))].sort();
    res.json({ archives, categories });
  })
);

// ── Publications publiées (lecture seule) ───────────────────────────────────

/** GET /espace/publications — communications officielles publiées du Barreau. */
espaceRouter.get(
  "/publications",
  asyncH(async (_req, res) => {
    res.json(await prisma.publication.findMany({ where: { statut: "PUBLIE" }, orderBy: { date: "desc" } }));
  })
);

/** GET /espace/publications/:id — détail d'une publication publiée. */
espaceRouter.get(
  "/publications/:id",
  asyncH(async (req: AuthRequest, res) => {
    const p = await prisma.publication.findUnique({ where: { id: Number(req.params.id) } });
    if (!p || p.statut !== "PUBLIE") throw new HttpError(404, "Publication introuvable");
    res.json(p);
  })
);

// ── Messagerie interne (avocat ↔ administration ↔ confrères) ─────────────────

/** Nom lisible de l'avocat connecté (pour figer l'auteur d'un message). */
async function monNom(req: AuthRequest) {
  const m = await prisma.membre.findUnique({ where: { id: monMembreId(req) }, select: { nom: true } });
  return m ? `Me ${m.nom}` : "Avocat";
}

/** Notifie l'administration (non bloquant) d'un nouveau message d'avocat. */
function notifierAdministration(sujet: string, auteurNom: string, corps: string) {
  notifierNouveauMessage(emailsAdministration, {
    titre: `nouveau message de ${auteurNom}`,
    intro: `${auteurNom} a adressé un message à l'administration du Barreau.`,
    cta: "Connectez-vous à l'espace d'administration (module « Messagerie ») pour y répondre.",
    auteurNom, sujet, corps,
  });
}

/** Notifie le(s) confrère(s) destinataire(s) (non bloquant) d'un message entre avocats. */
function notifierConfreres(membreIds: number[], sujet: string, auteurNom: string, corps: string) {
  notifierNouveauMessage(() => emailsMembres(membreIds), {
    titre: `nouveau message de ${auteurNom}`,
    intro: `${auteurNom} vous a adressé un message via la messagerie du Barreau.`,
    cta: "Connectez-vous à votre espace avocat (module « Messagerie ») pour y répondre.",
    auteurNom, sujet, corps,
  });
}

/** GET /espace/messagerie — fils de discussion de l'avocat (synthèse + non-lus). */
espaceRouter.get(
  "/messagerie",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const convs = await prisma.conversation.findMany({
      where: { participants: { some: { membreId: moi } } },
      orderBy: { updatedAt: "desc" },
      include: {
        participants: { include: { membre: { select: { id: true, nom: true } } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    const seuils = convs.map((c) => ({ conversationId: c.id, depuis: c.participants.find((p) => p.membreId === moi)?.lastReadAt ?? jamaisLu() }));
    const nonLusParFil = await compterNonLusParFil(messageNonDeMoi(moi), seuils);
    const result = convs.map((c) => {
      const autre = c.avecAdministration ? null : c.participants.find((p) => p.membreId !== moi)?.membre ?? null;
      const dernier = c.messages[0];
      return {
        id: c.id,
        sujet: c.sujet,
        avecAdministration: c.avecAdministration,
        interlocuteur: c.avecAdministration ? "Administration" : autre ? `Me ${autre.nom}` : "Confrère",
        updatedAt: c.updatedAt,
        apercu: dernier ? { corps: dernier.corps.slice(0, 140), auteurNom: dernier.auteurNom, estMoi: dernier.auteurMembreId === moi, createdAt: dernier.createdAt } : null,
        nonLus: nonLusParFil.get(c.id) ?? 0,
      };
    });
    res.json(result);
  })
);

/** GET /espace/messagerie/non-lus — total de messages non lus (pastille de navigation). */
espaceRouter.get(
  "/messagerie/non-lus",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const parts = await prisma.conversationParticipant.findMany({ where: { membreId: moi } });
    const seuils = parts.map((p) => ({ conversationId: p.conversationId, depuis: p.lastReadAt ?? jamaisLu() }));
    res.json({ total: await totalNonLus(messageNonDeMoi(moi), seuils) });
  })
);

/** GET /espace/messagerie/:id — fil détaillé ; marque le fil comme lu. */
espaceRouter.get(
  "/messagerie/:id",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { include: { membre: { select: { id: true, nom: true } } } }, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv || !conv.participants.some((p) => p.membreId === moi)) throw new HttpError(404, "Conversation introuvable");
    await prisma.conversationParticipant.update({
      where: { conversationId_membreId: { conversationId: id, membreId: moi } },
      data: { lastReadAt: new Date() },
    });
    const autre = conv.avecAdministration ? null : conv.participants.find((p) => p.membreId !== moi)?.membre ?? null;
    res.json({
      id: conv.id,
      sujet: conv.sujet,
      avecAdministration: conv.avecAdministration,
      interlocuteur: conv.avecAdministration ? "Administration" : autre ? `Me ${autre.nom}` : "Confrère",
      messages: conv.messages.map((m) => ({
        id: m.id,
        corps: m.corps,
        auteurNom: m.auteurNom,
        estMoi: m.auteurMembreId === moi,
        estAdministration: m.estAdministration,
        createdAt: m.createdAt,
      })),
    });
  })
);

const nouvelleConvSchema = z.object({
  sujet: z.string().trim().min(1).max(160),
  corps: z.string().trim().min(1).max(5000),
  avecAdministration: z.boolean().default(false),
  destinataireMembreId: z.number().int().positive().optional(),
});

/** POST /espace/messagerie — ouvre un fil (avec l'administration ou un confrère). */
espaceRouter.post(
  "/messagerie",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const { sujet, corps, avecAdministration, destinataireMembreId } = nouvelleConvSchema.parse(req.body);
    const auteurNom = await monNom(req);

    const participantsData: { membreId: number }[] = [{ membreId: moi }];
    if (!avecAdministration) {
      if (!destinataireMembreId || destinataireMembreId === moi) throw new HttpError(400, "Destinataire invalide.");
      const dest = await prisma.membre.findUnique({ where: { id: destinataireMembreId }, select: { id: true } });
      if (!dest) throw new HttpError(404, "Confrère introuvable.");
      participantsData.push({ membreId: destinataireMembreId });
    }

    const conv = await prisma.conversation.create({
      data: {
        sujet,
        avecAdministration,
        participants: { create: participantsData },
        messages: { create: { corps, auteurMembreId: moi, auteurNom, estAdministration: false } },
      },
    });
    if (avecAdministration) {
      notifierAdministration(sujet, auteurNom, corps);
      realtimeAdministration({ type: "messagerie", conversationId: conv.id });
    } else if (destinataireMembreId) {
      notifierConfreres([destinataireMembreId], sujet, auteurNom, corps);
      realtimeMembres([destinataireMembreId], { type: "messagerie", conversationId: conv.id });
    }
    res.status(201).json({ id: conv.id });
  })
);

const repondreSchema = z.object({ corps: z.string().trim().min(1).max(5000) });

/** POST /espace/messagerie/:id — répond dans un fil dont l'avocat est participant. */
espaceRouter.post(
  "/messagerie/:id",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const id = Number(req.params.id);
    const { corps } = repondreSchema.parse(req.body);
    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { participants: { select: { membreId: true } } },
    });
    if (!conv || !conv.participants.some((p) => p.membreId === moi)) throw new HttpError(404, "Conversation introuvable");
    const auteurNom = await monNom(req);
    const message = await prisma.message.create({
      data: { conversationId: id, corps, auteurMembreId: moi, auteurNom, estAdministration: false },
    });
    await prisma.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    if (conv.avecAdministration) {
      notifierAdministration(conv.sujet, auteurNom, corps);
      realtimeAdministration({ type: "messagerie", conversationId: id });
    } else {
      const autres = conv.participants.map((p) => p.membreId).filter((mid) => mid !== moi);
      notifierConfreres(autres, conv.sujet, auteurNom, corps);
      realtimeMembres(autres, { type: "messagerie", conversationId: id });
    }
    res.status(201).json({ id: message.id });
  })
);

// ── Élections : vote en ligne depuis l'espace avocat ─────────────────────────

/** GET /espace/scrutins — scrutins en ligne (ouverts/clos/publiés) + statut de vote de l'avocat. */
espaceRouter.get(
  "/scrutins",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const scrutins = await prisma.scrutin.findMany({
      where: { modalite: "EN_LIGNE", statut: { in: ["OUVERT", "CLOS", "PUBLIE"] } },
      orderBy: { id: "desc" },
      include: { candidats: { orderBy: [{ voix: "desc" }, { nom: "asc" }], select: { id: true, nom: true, voix: true } } },
    });
    const emarges = await prisma.emargement.findMany({ where: { membreId: moi, scrutinId: { in: scrutins.map((s) => s.id) } }, select: { scrutinId: true } });
    const aVote = new Set(emarges.map((e) => e.scrutinId));
    // Éligibilité électorale de l'avocat (même règle que le POST /voter) : exposée
    // pour que l'espace affiche l'état plutôt que de laisser buter sur un 403.
    const annee = new Date().getFullYear();
    const [membre, tarifs] = await Promise.all([
      prisma.membre.findUnique({ where: { id: moi }, include: { cotisations: { where: { annee } } } }),
      tarifsActuels(),
    ]);
    const eligible = membre ? eligibiliteElectorale(membre, membre.cotisations[0] ?? null, tarifs).eligible : false;
    res.json(
      scrutins.map((s) => ({
        id: s.id,
        titre: s.titre,
        type: s.type,
        statut: s.statut,
        nbSieges: s.nbSieges,
        aDejaVote: aVote.has(s.id),
        eligible,
        // Les voix ne sont révélées qu'une fois le scrutin publié.
        candidats: s.candidats.map((c) => ({ id: c.id, nom: c.nom, ...(s.statut === "PUBLIE" ? { voix: c.voix } : {}) })),
      }))
    );
  })
);

const voterSchema = z.object({ candidatIds: z.array(z.number().int()).min(1) });

/**
 * POST /espace/scrutins/:id/voter — vote en ligne, confidentiel et unique.
 * L'émargement trace la seule participation ; le choix n'est jamais stocké
 * individuellement (décompte agrégé), donc rien ne relie le votant à son vote.
 */
espaceRouter.post(
  "/scrutins/:id/voter",
  asyncH(async (req: AuthRequest, res) => {
    const moi = monMembreId(req);
    const id = Number(req.params.id);
    const scrutin = await prisma.scrutin.findUnique({ where: { id }, include: { candidats: { select: { id: true } } } });
    if (!scrutin) throw new HttpError(404, "Scrutin introuvable");
    if (scrutin.modalite !== "EN_LIGNE" || scrutin.statut !== "OUVERT") throw new HttpError(409, "Ce scrutin n'est pas ouvert au vote en ligne.");

    // Éligibilité de l'électeur (corps électoral : statut + cotisation à jour).
    const annee = new Date().getFullYear();
    const [membre, tarifs] = await Promise.all([
      prisma.membre.findUnique({ where: { id: moi }, include: { cotisations: { where: { annee } } } }),
      tarifsActuels(),
    ]);
    if (!membre) throw new HttpError(404, "Fiche introuvable");
    if (!eligibiliteElectorale(membre, membre.cotisations[0] ?? null, tarifs).eligible) {
      throw new HttpError(403, "Vous ne figurez pas dans le corps électoral pour ce scrutin.");
    }

    const { candidatIds } = voterSchema.parse(req.body);
    const valides = new Set(scrutin.candidats.map((c) => c.id));
    const choix = [...new Set(candidatIds)].filter((cid) => valides.has(cid));
    if (choix.length === 0) throw new HttpError(400, "Aucun candidat valide sélectionné.");
    if (choix.length > scrutin.nbSieges) throw new HttpError(400, `Vous ne pouvez voter que pour ${scrutin.nbSieges} candidat(s) au maximum.`);

    try {
      // Vote anonyme : on incrémente directement le décompte agrégé de chaque
      // candidat choisi, sans stocker de bulletin individuel — ainsi aucun
      // enregistrement (ni son ordre d'insertion) ne relie le votant à son choix.
      // L'émargement (unique) garantit l'unicité du vote ; incrément + émargement
      // dans la même transaction → un double vote annule tout (contrainte @@unique).
      await prisma.$transaction([
        prisma.emargement.create({ data: { scrutinId: id, membreId: moi } }),
        ...choix.map((cid) => prisma.candidat.update({ where: { id: cid }, data: { voix: { increment: 1 } } })),
      ]);
    } catch {
      throw new HttpError(409, "Vous avez déjà voté pour ce scrutin.");
    }
    res.status(201).json({ ok: true });
  })
);
