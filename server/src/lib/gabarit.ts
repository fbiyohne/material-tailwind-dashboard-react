/**
 * Socle commun des documents PDF (M-20261016) : point unique d'assemblage du HTML A4.
 * Reprend assembler() de scripts/apercus-gabarits.ts : socle.css + feuille de la direction
 * + règles @page propres au document (pied « dénomination · Réf. · Page x/y », en-tête courant
 * à partir de la page 2, paysage). Identité tirée des Paramètres (identite()), jamais en dur.
 * Voir gabarits/README.md.
 */
import fs from "node:fs";
import { esc } from "./documentsCommun.js";
import { identite, MENTION_DEMONSTRATION } from "./identiteDocuments.js";

export type DirectionPdf = "institutionnelle" | "classique" | "compacte";

/** Seul point de choix de la direction graphique (« Institutionnelle sobre » en attendant la validation de Fabrice). */
export const DIRECTION_PDF: DirectionPdf = "institutionnelle";
// PDF_DIRECTION : surcharge réservée au script de contrôle (scripts/controle-pdf.ts --direction), absente en production.
const SURCHARGE = process.env.PDF_DIRECTION as DirectionPdf | undefined;

/** Police des boîtes de marge (pied, en-tête courant) par direction. */
const POLICE_MARGE: Record<DirectionPdf, string> = {
  institutionnelle: "'DM Mono', monospace",
  classique: "Georgia, serif",
  compacte: "'DM Mono', monospace",
};

// Feuilles lues une fois au chargement (le serveur tourne sur les sources, sans copie vers dist).
const lire = (n: string) => fs.readFileSync(new URL(`./gabarits/${n}.css`, import.meta.url), "utf8");
const CSS = { socle: lire("socle"), institutionnelle: lire("institutionnelle"), classique: lire("classique"), compacte: lire("compacte") };

/** Clause CL-VERIF (avis juridique M-20261011), mot pour mot. */
export const CLAUSE_VERIF =
  "Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature.";

/** Clause C-PDF-LISTE (avis juridique M-20261016) : pied des listes non publiques. */
export const CLAUSE_LISTE =
  "Document à diffusion restreinte, réservé aux organes de l'Ordre. Contient des données à caractère personnel protégées par la loi n° 29-2019 du 10 octobre 2019. Toute rediffusion est interdite.";

/** Chaîne CSS sûre pour `content:` (guillemets, barres obliques et retours à la ligne neutralisés). */
const cssStr = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/\s+/g, " ")}"`;

export interface PageA4 {
  /** Titre court de l'en-tête courant (pages 2 et suivantes) et du <title>. */
  titreCourt: string;
  /** Référence du document, reprise dans le pied de chaque page. */
  reference: string;
  /** Document d'une seule page : le bloc de vérification est poussé en bas de page. */
  unePage: boolean;
  /** A4 paysage (listes larges). */
  paysage?: boolean;
  /** Liste non publique : clause C-PDF-LISTE dans le pied de chaque page. */
  listeRestreinte?: boolean;
  /** Corps du document (HTML déjà échappé). */
  contenu: string;
  /** Direction graphique ; DIRECTION_PDF par défaut (le paramètre sert au script de contrôle). */
  direction?: DirectionPdf;
}

/** HTML complet d'un document A4 : socle + direction + règles @page propres au document. */
export function pageA4({ titreCourt, reference, unePage, paysage, listeRestreinte, contenu, direction = SURCHARGE && SURCHARGE in CSS ? SURCHARGE : DIRECTION_PDF }: PageA4): string {
  const id = identite();
  const boite = `font-family: ${POLICE_MARGE[direction]}; font-size: 7.5pt; color: #7A756A;`;
  const pied = `${id.denomination} · Réf. ${reference}`;
  const page = `
@page {${paysage ? "\n  size: A4 landscape;" : ""}
  @bottom-left { content: ${listeRestreinte ? `${cssStr(pied)} "\\A" ${cssStr(CLAUSE_LISTE)}; white-space: pre-wrap;` : `${cssStr(pied)};`} ${boite} }
  @bottom-right { content: "Page " counter(page) "/" counter(pages); white-space: nowrap; ${boite} }
  @top-left { content: ${cssStr(`${id.denomination} · ${titreCourt}`)}; ${boite} }
}
@page :first { @top-left { content: none; } }`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titreCourt)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet">
<style>${CSS.socle}${CSS[direction]}${page}</style></head>
<body class="dir-${direction}"><div class="${unePage ? "une-page" : ""}">${contenu}
${id.modeDemonstration ? `<p class="mention-demo">${esc(MENTION_DEMONSTRATION)}</p>` : ""}</div></body></html>`;
}

/** Logo téléversé (Paramètres, base64 validée) ou sceau dessiné reprenant l'identité. */
function sceau(): string {
  const id = identite();
  if (id.logo) return `<img src="${id.logo}" alt="Logo">`;
  return `
<svg viewBox="0 0 100 100" aria-label="Sceau">
  <defs><path id="sc-h" d="M 18,50 A 32,32 0 0 1 82,50"/><path id="sc-b" d="M 82,52 A 32,32 0 0 1 18,52"/></defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" stroke-width="1.4"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" stroke-width="0.6"/>
  <text fill="#1A3A6B" font-size="5.4" font-weight="600" letter-spacing="0.6" font-family="DM Sans, sans-serif"><textPath href="#sc-h" startOffset="50%" text-anchor="middle">${esc(id.ordre.toUpperCase())}</textPath></text>
  <text fill="#1A3A6B" font-size="5.4" font-weight="600" letter-spacing="0.6" font-family="DM Sans, sans-serif"><textPath href="#sc-b" startOffset="50%" text-anchor="middle">${esc(id.denomination.toUpperCase())}</textPath></text>
  <g stroke="#1A3A6B" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="37" x2="50" y2="63"/><line x1="44" y1="63" x2="56" y2="63"/><line x1="38" y1="42" x2="62" y2="42"/>
    <circle cx="50" cy="38" r="1.6" fill="#C4990A" stroke="none"/>
    <line x1="38" y1="42" x2="38" y2="49"/><path d="M33,49 Q38,54 43,49"/>
    <line x1="62" y1="42" x2="62" y2="49"/><path d="M57,49 Q62,54 67,49"/>
  </g>
</svg>`;
}

/** En-tête d'identité (page 1) : sceau, dénomination, ordre, adresse, référence et date. */
export const entete = (refLabel: string, ref: string, dateLabel: string): string => {
  const id = identite();
  return `
<header class="entete">
  <div class="entete-sceau">${sceau()}</div>
  <div><p class="org-denom">${esc(id.denomination)}</p><p class="org-ordre">${esc(id.ordre)}</p><p class="org-adresse">${esc(id.adresse)}</p></div>
  <div class="entete-ref"><span class="ref-label">${esc(refLabel)}</span><span class="ref">${esc(ref)}</span><span class="ref-date">${esc(dateLabel)}</span></div>
</header>`;
};

export const titre = (surtitre: string, t: string): string =>
  `<div class="titre-bloc"><p class="surtitre">${esc(surtitre)}</p><h1 class="titre">${esc(t)}</h1></div>`;

/** Champs d'identité : [libellé, valeur, classes « nom » / « large » / « mono »]. */
export const champs = (lignes: [string, string, string?][]): string =>
  `<dl class="identite">${lignes.map(([dt, dd, cls = ""]) => `<div class="champ ${cls.includes("nom") ? "champ-nom" : ""} ${cls.includes("large") ? "champ-large" : ""}"><dt>${esc(dt)}</dt><dd class="${cls.includes("mono") ? "mono" : ""}">${esc(dd)}</dd></div>`).join("")}</dl>`;

/** Signatures : [rôle, nom, cachet ? (data URI de cachets.ts)]. */
export const signatures = (roles: [string, string, string?][]): string =>
  `<div class="signatures">${roles.map(([r, n, cachet]) => `<div class="signature"><p class="sig-role">${esc(r)}</p><div class="sig-espace">${cachet ? `<img src="${cachet}" alt="Cachet officiel" style="height:100%;object-fit:contain">` : ""}</div><p class="sig-nom">${esc(n)}</p></div>`).join("")}</div>`;

/**
 * Bloc QR + clause CL-VERIF. `qr` : data URI de qrDocument (inchangé) ou balisage SVG produit
 * par le serveur ; jamais une donnée saisie. Taille imprimée : --qr du socle (>= 25 mm).
 */
export const blocVerif = (qr: string, url: string): string =>
  `<aside class="verif">${qr.startsWith("<svg") ? qr : `<img src="${qr}" alt="Code de vérification">`}<div><p class="verif-titre">Vérification d'authenticité</p>
  <p class="verif-texte">Authenticité vérifiable en scannant ce code ou sur <span class="verif-url">${esc(url)}.</span> ${CLAUSE_VERIF}</p></div></aside>`;
