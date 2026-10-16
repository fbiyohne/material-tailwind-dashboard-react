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

export type DirectionPdf = "officielle" | "institutionnelle" | "classique" | "compacte";

/** Seul point de choix de la direction graphique : « Officielle », fidèle au papier à en-tête du Barreau (2026-10-16). */
export const DIRECTION_PDF: DirectionPdf = "officielle";
// PDF_DIRECTION : surcharge réservée au script de contrôle (scripts/controle-pdf.ts --direction), absente en production.
const SURCHARGE = process.env.PDF_DIRECTION as DirectionPdf | undefined;

/** Police des boîtes de marge (pied, en-tête courant) par direction. */
const POLICE_MARGE: Record<DirectionPdf, string> = {
  officielle: "Montserrat, 'Segoe UI', sans-serif",
  institutionnelle: "'DM Mono', monospace",
  classique: "Georgia, serif",
  compacte: "'DM Mono', monospace",
};

// Feuilles lues une fois au chargement (le serveur tourne sur les sources, sans copie vers dist).
const lire = (n: string) => fs.readFileSync(new URL(`./gabarits/${n}.css`, import.meta.url), "utf8");
const CSS = { socle: lire("socle"), officielle: lire("officielle"), institutionnelle: lire("institutionnelle"), classique: lire("classique"), compacte: lire("compacte") };

/** Logo officiel du Barreau (repris des modèles Word du Conseil de l'Ordre), en data URI ; vide s'il manque. */
const LOGO_OFFICIEL = (() => {
  for (const p of ["assets/logo-barreau.png", "server/assets/logo-barreau.png"]) {
    try { return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`; } catch { /* dossier suivant */ }
  }
  return "";
})();

/** Pictogrammes du pied officiel : trait unique, même famille (téléphone, globe, repère). */
const ICO = {
  tel: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  lieu: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
};
const ico = (k: keyof typeof ICO) => `<svg viewBox="0 0 24 24" style="width:3.4mm;height:3.4mm;flex:none;margin-top:.2mm;fill:none;stroke:#1E2430;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">${ICO[k]}</svg>`;

/**
 * Pied officiel de chaque page (marge basse) : filet bleu, coordonnées, référence et pagination,
 * bandes jaune et bleue du papier à en-tête. Gabarit HTML de Chrome : styles en ligne obligatoires.
 */
function piedOfficiel(reference: string, listeRestreinte?: boolean): string {
  const id = identite();
  const tels = id.telephones.split("/").map((t) => t.trim()).filter(Boolean);
  const adresse = id.adresse.split(/\s+—\s+/).filter(Boolean);
  const col = (k: keyof typeof ICO, lignes: string[]) => lignes.length ? `<div style="display:flex;gap:2mm;align-items:flex-start">${ico(k)}<span>${lignes.map(esc).join("<br>")}</span></div>` : "";
  const pied = (page: string) => `
<div style="position:relative;width:100%;height:32mm;font-family:Montserrat,'Segoe UI',Arial,sans-serif;font-size:7.6pt;line-height:1.35;color:#1E2430;-webkit-print-color-adjust:exact;print-color-adjust:exact">
  <div style="margin:0 15mm;border-top:.8pt solid #2E67B1"></div>
  <div style="display:flex;justify-content:space-between;gap:6mm;margin:2.6mm 15mm 0">${col("tel", tels)}${col("web", [id.courriel, id.site].filter(Boolean))}${col("lieu", adresse)}</div>
  ${listeRestreinte ? `<div style="margin:1.6mm 15mm 0;font-size:6.4pt;color:#5A6170">${esc(CLAUSE_LISTE)}</div>` : ""}
  <div style="position:absolute;right:15mm;bottom:11mm;font-size:6.6pt;color:#5A6170">Réf. ${esc(reference)} · ${page}</div>
  <div style="position:absolute;left:0;bottom:5.5mm;width:46%;height:4mm;background:#FDD13B;clip-path:polygon(0 0,96% 0,100% 100%,0 100%)"></div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:5.5mm;background:#2E67B1"></div>
</div>`;
  // Le gabarit de Chrome n'existe qu'au PDF ; .pied-ecran le reproduit pour l'aperçu à l'écran (masqué à l'impression).
  return `<template id="pied-pdf"><style>html,body{margin:0;padding:0}#footer{padding:0!important}</style>${pied('Page <span class="pageNumber"></span>/<span class="totalPages"></span>')}</template>
<div class="pied-ecran">${pied("Aperçu")}</div>`;
}

/** Clause CL-VERIF (avis juridique M-20261011), mot pour mot. */
export const CLAUSE_VERIF =
  "Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature.";

/** Clause C-PDF-LISTE (avis juridique M-20261016) : pied des listes non publiques. */
export const CLAUSE_LISTE =
  "Document à diffusion restreinte, réservé aux organes de l'Ordre. Contient des données à caractère personnel protégées par la loi n° 29-2019 du 10 octobre 2019. Toute rediffusion est interdite.";

/** Chaîne CSS sûre pour `content:` (guillemets, barres obliques et retours à la ligne neutralisés). */
const cssStr = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/</g, "\\3C ").replace(/\s+/g, " ")}"`;

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
  const officielle = direction === "officielle";
  const page = officielle ? `
@page {${paysage ? "\n  size: A4 landscape;" : ""}
  @top-left { content: ${cssStr(`${id.denomination} · ${titreCourt}`)}; ${boite} }
}
@page :first { @top-left { content: none; } }` : `
@page {${paysage ? "\n  size: A4 landscape;" : ""}
  @bottom-left { content: ${listeRestreinte ? `${cssStr(pied)} "\\A" ${cssStr(CLAUSE_LISTE)}; white-space: pre-wrap;` : `${cssStr(pied)};`} ${boite} }
  @bottom-right { content: "Page " counter(page) "/" counter(pages); white-space: nowrap; ${boite} }
  @top-left { content: ${cssStr(`${id.denomination} · ${titreCourt}`)}; ${boite} }
}
@page :first { @top-left { content: none; } }`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titreCourt)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=DM+Mono&family=Montserrat:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<style>${CSS.socle}${CSS[direction]}${page}</style></head>
<body class="dir-${direction}"><div class="${unePage ? "une-page" : ""}">${contenu}
${id.modeDemonstration ? `<p class="mention-demo">${esc(MENTION_DEMONSTRATION)}</p>` : ""}</div>${officielle ? piedOfficiel(reference, listeRestreinte) : ""}</body></html>`;
}

/** Logo téléversé (Paramètres, base64 validée) ou sceau dessiné reprenant l'identité. */
function sceau(): string {
  const id = identite();
  if (id.logo) return `<img src="${id.logo}" alt="Logo">`;
  if (LOGO_OFFICIEL) return `<img src="${LOGO_OFFICIEL}" alt="${esc(id.ordre)}, ${esc(id.denomination)}">`;
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
  if ((SURCHARGE && SURCHARGE in CSS ? SURCHARGE : DIRECTION_PDF) === "officielle") return `
<header class="entete-off">
  <div class="bandeau"><i></i>${sceau()}<i></i></div>
  <div class="emetteur"><div><b>${esc(id.ordre)}</b>${esc(id.denomination)}</div>
    <div class="droite">${esc(refLabel)} <span class="ref">${esc(ref)}</span><br>${esc(dateLabel)}</div></div>
</header>`;
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
  <p class="verif-texte">Scannez ce code avec l'appareil photo d'un téléphone, ou rendez-vous sur <span class="verif-url">${esc(url)}</span>. ${CLAUSE_VERIF}</p></div></aside>`;

/** Emplacement du QR dans l'aperçu d'un document pas encore délivré (aucun code signé n'existe encore). */
export const QR_APERCU = `<svg viewBox="0 0 100 100" role="img" aria-label="Code de vérification attribué à la délivrance"><rect x="2" y="2" width="96" height="96" fill="none" stroke="#9AA3B2" stroke-width="2" stroke-dasharray="6 5"/><text x="50" y="47" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="10" fill="#5A6170">QR attribué</text><text x="50" y="61" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="10" fill="#5A6170">à l'émission</text></svg>`;
