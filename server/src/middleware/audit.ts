import type { Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { logger } from "../lib/logger.js";
import type { AuthRequest } from "./auth.js";

/** Libellés lisibles par ressource (1er segment après /api). */
const RESSOURCES: Record<string, string> = {
  membres: "Avocat",
  cotisations: "Cotisation",
  recus: "Reçu",
  quitus: "Quitus",
  discipline: "Dossier disciplinaire",
  reunions: "Réunion",
  assemblees: "Assemblée générale",
  publications: "Publication",
  archives: "Archive",
  parametres: "Paramètres",
  auth: "Session",
  espace: "Espace avocat",
  messagerie: "Messagerie",
  scrutins: "Scrutin",
};

/**
 * Lectures sensibles journalisées malgré la méthode GET (R-62 / CA10) : la liste
 * des dossiers disciplinaires, leur journal, un dossier et ses PDF (convocation, décision).
 * Le chemin seul est retenu, jamais le contenu de la réponse. Une route peut
 * aussi rendre un GET journalisable en posant `res.locals.auditDetail`
 * (ex. casier d'un membre, dont l'identifiant est en query string).
 */
const LECTURES_SENSIBLES = [/^\/api\/discipline(\/journal|\/\d+(\/(convocation|decision)\/pdf)?)?$/];

const VERBES: Record<string, string> = { GET: "Consultation", POST: "Création", PATCH: "Mise à jour", PUT: "Mise à jour", DELETE: "Suppression" };

/** Construit un libellé d'action lisible à partir de la méthode et du chemin. */
function libelle(methode: string, chemin: string): { action: string; cible: string | null; ressource: string } {
  const segments = chemin.replace(/^\/api\//, "").split("/").filter(Boolean);
  // La messagerie est une ressource à part entière, qu'elle soit atteinte par
  // /messagerie (administration) ou /espace/messagerie (avocat).
  const ressource = segments.includes("messagerie") ? RESSOURCES.messagerie : RESSOURCES[segments[0]] ?? segments[0] ?? "Ressource";
  const sousAction = segments.find((s) => ["paiement", "valider", "radier", "deces", "import", "export", "relances", "statut", "attestation", "convocation", "pv", "decision", "login", "logout", "messagerie"].includes(s));
  // Cible : le premier segment numérique (id du membre, du fil, du dossier…).
  const id = segments.find((s) => /^\d+$/.test(s));
  const cibleId = id ? `#${id}` : null;
  if (sousAction) {
    const map: Record<string, string> = {
      paiement: "Enregistrement d'un paiement", valider: "Validation Trésorière", radier: "Radiation d'un avocat",
      deces: "Déclaration de décès", import: "Import du tableau", export: "Export de la liste des avocats",
      relances: "Lancement des relances", statut: "Changement de statut", attestation: "Génération d'attestation",
      convocation: "Génération de convocation", pv: "Génération de procès-verbal", decision: "Génération de décision",
      login: "Connexion", logout: "Déconnexion", messagerie: "Envoi d'un message",
    };
    return { action: `${map[sousAction]} — ${ressource}`, cible: cibleId, ressource };
  }
  return { action: `${VERBES[methode] ?? methode} — ${ressource}`, cible: cibleId, ressource };
}

/**
 * Journalise toute action importante (mutation réussie) dans JournalAudit (RG-16 / NFR-09),
 * ainsi que les écritures refusées en 403 (« Accès refusé — <ressource> », D18) : les GET
 * refusés ne le sont pas, pour ne pas inonder le journal. Jamais le corps de la requête.
 * Écriture asynchrone après envoi de la réponse : n'impacte jamais la latence client.
 */
export function audit(req: AuthRequest, res: Response, next: NextFunction) {
  const chemin = req.originalUrl.split("?")[0];
  if (req.method === "OPTIONS" || req.method === "HEAD") return next();
  const lectureSensible = req.method !== "GET" || LECTURES_SENSIBLES.some((re) => re.test(chemin));
  // IP capturée à la réception (req.ip fiable via « trust proxy ») ; on retire le
  // préfixe IPv4-mapped (::ffff:) pour un affichage lisible.
  const ip = (req.ip ?? "").replace(/^::ffff:/, "") || null;
  res.on("finish", () => {
    if (res.locals.auditFait) return;
    const refus = res.statusCode === 403 && req.method !== "GET";
    if (res.statusCode >= 400 && !refus) return;
    if (!lectureSensible && !res.locals.auditDetail) return;
    const l = libelle(req.method, chemin);
    const base = refus ? `Accès refusé — ${l.ressource}` : l.action;
    const cible = l.cible;
    // auditDetail ne porte jamais de contenu utilisateur (corps de message, pièce) :
    // seulement un identifiant ou un comptage.
    const detail = res.locals.auditDetail;
    const action = detail ? `${base} (${detail})` : base;
    prisma.journalAudit
      .create({
        data: {
          action, cible, methode: req.method, chemin, ip,
          // userNom dénormalisé : l'entrée reste attribuable même après suppression
          // du compte, et la recherche par acteur (filtre) devient effective.
          statut: res.statusCode, userId: req.user?.id ?? null, userNom: req.user?.nom ?? null,
        },
      })
      .catch((err) => logger.warn({ err }, "Échec d'écriture du journal d'audit"));
  });
  next();
}
