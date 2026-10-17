import type { Response, NextFunction } from "express";
import { prisma } from "../prisma.js";
import { logger } from "../lib/logger.js";
import type { AuthRequest } from "./auth.js";
import { HttpError } from "./error.js";

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
  pieces: "Pièce",
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
  const segments = chemin.toLowerCase().replace(/^\/api\//, "").split("/").filter(Boolean);
  // La messagerie est une ressource à part entière, qu'elle soit atteinte par
  // /messagerie (administration) ou /espace/messagerie (avocat).
  const ressource = segments.includes("messagerie") ? RESSOURCES.messagerie : RESSOURCES[segments[0]] ?? segments[0] ?? "Ressource";
  // « messagerie » ne vaut « Envoi d'un message » qu'en écriture : un GET reste une « Consultation ».
  const sousAction = segments.find((s) => ["paiement", "valider", "radier", "deces", "import", "export", "relances", "statut", "attestation", "convocation", "pv", "decision", "login", "logout"].includes(s) || (s === "messagerie" && methode !== "GET"));
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

// IP capturée à la réception (req.ip fiable via « trust proxy ») ; préfixe IPv4-mapped (::ffff:) retiré.
const ipDe = (req: AuthRequest) => (req.ip ?? "").replace(/^::ffff:/, "") || null;

/**
 * Lecture de contenu par l'ADMIN (liste des fils, fil, pièce jointe, fichier de pièce) :
 * accès autorisé (décision du 16/10/2026), tracé dans JournalAudit AVANT de servir le contenu.
 * À appeler dans la route, une fois la ressource trouvée, juste avant l'envoi. Si la ligne
 * ne peut pas être écrite, le contenu n'est pas servi (503) : pas d'accès sans trace.
 * Sans effet pour les autres rôles. Le chemin seul est écrit, jamais le contenu.
 */
export async function tracerLectureAdmin(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.role !== "ADMIN") return;
  const chemin = req.originalUrl.split("?")[0];
  const l = libelle("GET", chemin);
  try {
    await prisma.journalAudit.create({
      data: { action: l.action, cible: l.cible, methode: "GET", chemin, ip: ipDe(req), statut: 200, userId: req.user.id, userNom: req.user.nom ?? null },
    });
  } catch (err) {
    logger.error({ err, chemin }, "Lecture ADMIN refusée : journal d'audit indisponible");
    throw new HttpError(503, "Journal d'audit indisponible : contenu non servi, réessayez plus tard.");
  }
  res.locals.auditFait = true; // le middleware générique n'écrit pas de doublon
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
  const ip = ipDe(req);
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
