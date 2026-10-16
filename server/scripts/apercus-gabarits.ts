/**
 * Aperçus des gabarits PDF sur données fictives (mission M-20261011, point 8). Le socle est appliqué
 * en production par src/lib/gabarit.ts (M-20261016) ; ce script n'est importé nulle part.
 *
 * Usage (depuis server/) : npx tsx scripts/apercus-gabarits.ts
 * Entrées : server/src/lib/gabarits/socle.css + une feuille par direction (source unique, lue aussi par gabarit.ts).
 * Sorties : docs/design/pdf/gabarits/html/<direction>/<document>.html (HTML autonome)
 *           docs/design/pdf/apercus/<direction>-<document>.pdf (rendu par htmlVersPdf, comme en production)
 * Contrôle : chaque page doit mesurer 210 x 297 mm et la liste doit dépasser une page ; sinon code de sortie 1.
 * Données entièrement fictives (« Barreau de démonstration ») ; aucune base n'est lue.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import QRCode from "qrcode";
import { htmlVersPdf } from "../src/lib/pdf.js";
import { esc, fmtFCFA, fmtDateFr } from "../src/lib/documentsCommun.js";
import { montantEnLettresFCFA } from "../src/lib/montantEnLettres.js";
import { finValiditeQuitus } from "../src/lib/business.js";
import { MENTION_DEMONSTRATION } from "../src/lib/identiteDocuments.js";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../../docs/design/pdf");
const GABARITS = path.resolve(ICI, "../src/lib/gabarits"); // feuilles CSS (source unique)
const HTML = path.join(RACINE, "gabarits", "html"); // HTML autonomes générés
const APERCUS = path.join(RACINE, "apercus");

/** Police des boîtes de marge (pied et en-tête courant) par direction. */
const DIRECTIONS: Record<string, string> = {
  institutionnelle: "'DM Mono', monospace",
  classique: "Georgia, serif",
  compacte: "'DM Mono', monospace",
};

// ---------- Données fictives ----------
const ID = {
  denom: "Barreau de démonstration",
  ordre: "Ordre national des avocats (démonstration)",
  adresse: "Maison de l'Avocat, 1 avenue de l'Exemple, Ville-Démo",
  ville: "Ville-Démo",
  batonnier: "Me ELENGA Thierry",
  tresorier: "Me NGOMA Ruth",
  sg: "Me OKEMBA Serge",
  origine: "https://barreau-demo.cg",
};
const EMIS = new Date(Date.UTC(2026, 9, 11));
const VALIDITE_MOIS = 3; // regles.quitus.validiteMois (paramètre, défaut 3) : jamais écrit en dur dans le texte
const TITULAIRE = {
  nom: "Me MAKAYA Prisca Inès",
  numero: "PN-0142",
  inscription: new Date(Date.UTC(2015, 2, 2)),
  adresse: "Cabinet Makaya & Associés, 12 avenue de l'Exemple, Ville-Démo",
};
const NOMS = ["BATCHI", "ELENGA", "GOMA", "IBARA", "KIMBEMBE", "LOEMBA", "MABIALA", "MAKOSSO", "MASSAMBA", "MBEMBA", "MOUKALA", "NDINGA", "NGOMA", "NKOUKA", "OKEMBA", "OSSETE", "PAMBOU", "SAMBA", "TATI", "YOKA"];
const PRENOMS = ["Aimée", "Brice", "Carine", "Didier", "Estelle", "Fabrice", "Gloria", "Hervé", "Inès", "Jules", "Kevine", "Landry"];
const CABINETS = ["Cabinet Exemple & Associés", "SCP Fictive Avocats", "Cabinet Démo Conseil", "Exercice individuel", "Cabinet Modèle"];

// ---------- Briques HTML communes ----------
/** Chaîne CSS sûre pour `content:` (guillemets, barres obliques et retours à la ligne neutralisés). */
const cssStr = (s: string) => `"${s.replace(/[\\"]/g, "\\$&").replace(/\s+/g, " ")}"`;

const sceau = (id: string) => `
<svg viewBox="0 0 100 100" aria-label="Sceau">
  <defs><path id="${id}-h" d="M 18,50 A 32,32 0 0 1 82,50"/><path id="${id}-b" d="M 82,52 A 32,32 0 0 1 18,52"/></defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" stroke-width="1.4"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" stroke-width="0.6"/>
  <text fill="#1A3A6B" font-size="5.4" font-weight="600" letter-spacing="0.6" font-family="DM Sans, sans-serif"><textPath href="#${id}-h" startOffset="50%" text-anchor="middle">ORDRE NATIONAL DES AVOCATS</textPath></text>
  <text fill="#1A3A6B" font-size="5.4" font-weight="600" letter-spacing="0.6" font-family="DM Sans, sans-serif"><textPath href="#${id}-b" startOffset="50%" text-anchor="middle">BARREAU DE DÉMONSTRATION</textPath></text>
  <g stroke="#1A3A6B" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="37" x2="50" y2="63"/><line x1="44" y1="63" x2="56" y2="63"/><line x1="38" y1="42" x2="62" y2="42"/>
    <circle cx="50" cy="38" r="1.6" fill="#C4990A" stroke="none"/>
    <line x1="38" y1="42" x2="38" y2="49"/><path d="M33,49 Q38,54 43,49"/>
    <line x1="62" y1="42" x2="62" y2="49"/><path d="M57,49 Q62,54 67,49"/>
  </g>
</svg>`;

const entete = (refLabel: string, ref: string, dateLabel: string) => `
<header class="entete">
  <div class="entete-sceau">${sceau("s")}</div>
  <div><p class="org-denom">${esc(ID.denom)}</p><p class="org-ordre">${esc(ID.ordre)}</p><p class="org-adresse">${esc(ID.adresse)}</p></div>
  <div class="entete-ref"><span class="ref-label">${esc(refLabel)}</span><span class="ref">${esc(ref)}</span><span class="ref-date">${esc(dateLabel)}</span></div>
</header>`;

const titre = (surtitre: string, t: string) =>
  `<div class="titre-bloc"><p class="surtitre">${esc(surtitre)}</p><h1 class="titre">${esc(t)}</h1></div>`;

const champs = (lignes: [string, string, string?][]) =>
  `<dl class="identite">${lignes.map(([dt, dd, cls = ""]) => `<div class="champ ${cls.includes("nom") ? "champ-nom" : ""} ${cls.includes("large") ? "champ-large" : ""}"><dt>${esc(dt)}</dt><dd class="${cls.includes("mono") ? "mono" : ""}">${esc(dd)}</dd></div>`).join("")}</dl>`;

const signatures = (roles: [string, string][]) =>
  `<div class="signatures">${roles.map(([r, n]) => `<div class="signature"><p class="sig-role">${esc(r)}</p><div class="sig-espace"></div><p class="sig-nom">${esc(n)}</p></div>`).join("")}</div>`;

/** Bloc QR + clause CL-VERIF (avis juridique M-20261011). QR niveau M, 28 mm imprimé. */
async function verif(url: string) {
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#0d2247", light: "#ffffff" } });
  return `<aside class="verif">${svg}<div><p class="verif-titre">Vérification d'authenticité</p>
  <p class="verif-texte">Authenticité vérifiable en scannant ce code ou sur <span class="verif-url">${esc(url)}.</span> Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature.</p></div></aside>`;
}

interface Doc { nom: string; titreCourt: string; ref: string; unePage: boolean; contenu: string }

/** Assemble le HTML autonome : socle + direction + règles @page propres au document. */
function assembler(direction: string, d: Doc): string {
  const css = fs.readFileSync(path.join(GABARITS, "socle.css"), "utf8") + fs.readFileSync(path.join(GABARITS, `${direction}.css`), "utf8");
  const police = DIRECTIONS[direction];
  const boite = `font-family: ${police}; font-size: 7.5pt; color: #7A756A;`;
  const page = `
@page {
  @bottom-left { content: ${cssStr(`${ID.denom} · Réf. ${d.ref}`)}; ${boite} }
  @bottom-right { content: "Page " counter(page) "/" counter(pages); ${boite} }
  @top-left { content: ${cssStr(`${ID.denom} · ${d.titreCourt}`)}; ${boite} }
}
@page :first { @top-left { content: none; } }`;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${esc(d.titreCourt)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet">
<style>${css}${page}</style></head>
<body class="dir-${direction}"><div class="${d.unePage ? "une-page" : ""}">${d.contenu}
<p class="mention-demo">${esc(MENTION_DEMONSTRATION)}</p></div></body></html>`;
}

// ---------- Documents ----------
async function quitus(): Promise<Doc> {
  const ref = "Q-2026-0042";
  const fin = finValiditeQuitus(EMIS, VALIDITE_MOIS);
  return {
    nom: "quitus", titreCourt: "Quitus", ref, unePage: true,
    contenu: `${entete("Quitus n°", ref, `Délivré le ${fmtDateFr(EMIS)}`)}<main>
${titre("Certificat de non-redevance", "Quitus")}
<p class="preambule">Le Bâtonnier de l'Ordre atteste qu'après vérification des écritures de l'Ordre, Maître :</p>
${champs([["Nom et prénoms", TITULAIRE.nom, "nom"], ["N° d'inscription", TITULAIRE.numero, "mono"], ["Date d'inscription", fmtDateFr(TITULAIRE.inscription)], ["Adresse professionnelle", TITULAIRE.adresse, "large"]])}
<div class="corps"><p class="declaration">est à jour de ses cotisations, contributions et redevances envers l'Ordre au titre de l'exercice 2026.</p>
<p>En foi de quoi, le présent quitus lui est délivré pour servir et valoir ce que de droit.</p></div>
<div class="encart"><p class="encart-titre">Validité</p>
<p>Le présent quitus est délivré au vu des écritures de l'Ordre à la date du ${fmtDateFr(EMIS)}. Il est valable jusqu'au <b>${fmtDateFr(fin)}</b> inclus, sauf changement de situation du titulaire, consultable à tout moment par le code de vérification.</p></div>
<p class="fait-a">Fait à ${esc(ID.ville)}, le ${fmtDateFr(EMIS)}.</p>
</main>
<div class="cloture">${signatures([["Le Trésorier", ID.tresorier], ["Le Bâtonnier", ID.batonnier]])}${await verif(`${ID.origine}/v/q/${ref}.K7M2Q9XAB4`)}</div>`,
  };
}

async function recu(): Promise<Doc> {
  const ref = "R-2026-0187";
  const lignes: [string, string, number][] = [["Cotisation annuelle (avocat inscrit)", "2026", 150_000], ["Contribution à la caisse de solidarité", "2026", 25_000]];
  const total = lignes.reduce((s, l) => s + l[2], 0);
  return {
    nom: "recu", titreCourt: "Reçu de paiement", ref, unePage: true,
    contenu: `${entete("Reçu n° (série continue)", ref, `Émis le ${fmtDateFr(EMIS)}`)}<main>
${titre("Pièce de recette", "Reçu de paiement")}
${champs([["Payeur", TITULAIRE.nom, "nom"], ["N° d'inscription", TITULAIRE.numero, "mono"], ["Mode de paiement", "Mobile Money MTN (bac à sable)"], ["Référence de transaction", "MTN-SBX-26101114-8831", "mono large"]])}
<table><thead><tr><th>Objet</th><th>Exercice couvert</th><th class="num">Montant</th></tr></thead>
<tbody>${lignes.map(([o, e, m]) => `<tr><td>${esc(o)}</td><td>${e}</td><td class="num">${fmtFCFA(m)}</td></tr>`).join("")}</tbody>
<tfoot><tr><td colspan="2">Total encaissé</td><td class="num">${fmtFCFA(total)}</td></tr></tfoot></table>
<div class="encart"><p class="encart-titre">Montant reçu</p><p class="montant-chiffres">${fmtFCFA(total)}</p><p class="montant-lettres">${esc(montantEnLettresFCFA(total))}</p></div>
<p class="fait-a">Fait à ${esc(ID.ville)}, le ${fmtDateFr(EMIS)}.</p>
</main>
<div class="cloture">${signatures([["Pour l'Ordre, le Trésorier", ID.tresorier], ["Cachet de l'Ordre", " "]])}${await verif(`${ID.origine}/v/r/${ref}.Q4T8ZC1NWE`)}</div>`,
  };
}

async function timbre(): Promise<Doc> {
  const ref = "T-2026-00318";
  return {
    nom: "timbre", titreCourt: "Timbre de plaidoirie", ref, unePage: true,
    contenu: `${entete("Timbre n°", ref, `Émis le ${fmtDateFr(EMIS)}`)}<main>
<div class="vignette"><p class="vignette-type">Timbre de plaidoirie</p><p class="vignette-numero">${ref}</p>
<p class="vignette-montant">${fmtFCFA(5_000)}</p><p class="vignette-code">TPL-7KQ2-M9XA</p>
${await verif(`${ID.origine}/v/t/${ref}.M3VJ8D2KRP`)}</div>
<h2 class="section">Volet de contrôle</h2>
${champs([["Affaire", "Société Exemple SA c/ Entreprise Fictive SARL", "large"], ["Juridiction", "Tribunal de grande instance de Ville-Démo", "large"], ["N° de rôle", "RG 2026/1187", "mono"], ["Date d'audience", fmtDateFr(new Date(Date.UTC(2026, 9, 14)))], ["Avocat constitué", TITULAIRE.nom], ["Statut", "Valide, non utilisé"]])}
<div class="corps"><p>Timbre n° ${ref}, émis le ${fmtDateFr(EMIS)} pour l'affaire Tribunal de grande instance de Ville-Démo – RG 2026/1187. Valable pour cette seule affaire. Toute reproduction pour un autre acte est sans valeur.</p></div>
<p class="mention-prototype">Prototype – sans valeur, aucun paiement réel</p></main>`,
  };
}

async function attestation(): Promise<Doc> {
  const ref = "A-2026-0311";
  return {
    nom: "attestation", titreCourt: "Attestation d'inscription", ref, unePage: true,
    contenu: `${entete("Attestation n°", ref, `Délivrée le ${fmtDateFr(EMIS)}`)}<main>
${titre("Tableau de l'Ordre", "Attestation d'inscription")}
<p class="preambule">Le Bâtonnier de l'Ordre atteste que :</p>
${champs([["Nom et prénoms", TITULAIRE.nom, "nom"], ["N° d'inscription", TITULAIRE.numero, "mono"], ["Date d'inscription", fmtDateFr(TITULAIRE.inscription)], ["Qualité", "Avocat inscrit au tableau", "large"], ["Adresse professionnelle", TITULAIRE.adresse, "large"]])}
<div class="corps"><p class="declaration">figure au Tableau de l'Ordre à la date des présentes.</p>
<p>La présente attestation est délivrée à l'intéressée, à sa demande, pour servir et valoir ce que de droit.</p></div>
<p class="fait-a">Fait à ${esc(ID.ville)}, le ${fmtDateFr(EMIS)}.</p>
</main>
<div class="cloture">${signatures([["Le Bâtonnier", ID.batonnier], ["Cachet de l'Ordre", " "]])}${await verif(`${ID.origine}/v/a/${ref}.H2W9PX4FNC`)}</div>`,
  };
}

function liste(): Doc {
  const ref = "TAB-2026-10";
  const arrete = new Date(Date.UTC(2026, 9, 1));
  const membre = (i: number, base: number) => ({
    rang: i + 1,
    nom: `Me ${NOMS[(i * 7) % NOMS.length]} ${PRENOMS[(i * 5) % PRENOMS.length]}`,
    numero: `PN-${String(base + i).padStart(4, "0")}`,
    serment: new Date(Date.UTC(1990 + Math.floor(i / 2), (i * 3) % 12, 1 + (i % 27))),
    cabinet: CABINETS[i % CABINETS.length],
  });
  const avocats = Array.from({ length: 60 }, (_, i) => membre(i, 1));
  const stagiaires = Array.from({ length: 12 }, (_, i) => ({ ...membre(i + 60, 1), serment: new Date(Date.UTC(2025, i % 12, 10)) }));
  const tableau = (rows: typeof avocats) => `<table><thead><tr><th class="num">Rang</th><th>Nom et prénoms</th><th>N° d'inscription</th><th>Prestation de serment</th><th>Domicile professionnel</th></tr></thead>
<tbody>${rows.map((m) => `<tr><td class="num mono">${m.rang}</td><td>${esc(m.nom)}</td><td class="mono">${m.numero}</td><td>${fmtDateFr(m.serment)}</td><td>${esc(m.cabinet)}</td></tr>`).join("")}</tbody></table>`;
  return {
    nom: "liste", titreCourt: `Tableau de l'Ordre arrêté au ${fmtDateFr(arrete)}`, ref, unePage: false,
    contenu: `${entete("Référence", ref, `Arrêté au ${fmtDateFr(arrete)}`)}<main>
${titre("Liste officielle", "Tableau de l'Ordre")}
<p class="sous-titre">Tableau des avocats inscrits, dressé par ordre d'ancienneté et arrêté par le Conseil de l'Ordre en sa séance du ${fmtDateFr(arrete)}.</p>
<dl class="meta"><div><dt>Date d'arrêté</dt><dd>${fmtDateFr(arrete)}</dd></div><div><dt>Avocats inscrits</dt><dd>${avocats.length}</dd></div><div><dt>Avocats stagiaires</dt><dd>${stagiaires.length}</dd></div><div><dt>Total</dt><dd>${avocats.length + stagiaires.length}</dd></div></dl>
<h2 class="section">I. Avocats inscrits <span class="compte">(${avocats.length})</span></h2>${tableau(avocats)}
<h2 class="section">II. Avocats stagiaires <span class="compte">(${stagiaires.length})</span></h2>${tableau(stagiaires)}
<div class="cloture"><p class="fait-a">Arrêté à ${esc(ID.ville)}, le ${fmtDateFr(arrete)}.</p>
${signatures([["Le Secrétaire général", ID.sg], ["Le Bâtonnier", ID.batonnier]])}</div></main>`,
  };
}

function pv(): Doc {
  const ref = "PV-AG-2026-02";
  const seance = new Date(Date.UTC(2026, 8, 26));
  const transmis = new Date(Date.UTC(2026, 9, 3));
  const resolutions: [string, string, number, number, number][] = [
    ["Approbation du procès-verbal de l'assemblée générale du 27 mars 2026", "L'assemblée, après lecture, approuve le procès-verbal de sa précédente séance sans observation.", 46, 0, 2],
    ["Approbation des comptes de l'exercice 2025", "Le Trésorier présente les comptes de l'exercice clos le 31 décembre 2025. Après les réponses apportées aux questions des membres, l'assemblée approuve les comptes et donne quitus au Trésorier pour sa gestion.", 41, 3, 4],
    ["Fixation du montant de la cotisation 2027", "Sur proposition du Conseil de l'Ordre, l'assemblée fixe la cotisation annuelle de l'avocat inscrit à 150 000 FCFA et celle de l'avocat stagiaire à 75 000 FCFA pour l'exercice 2027.", 38, 6, 4],
    ["Programme de formation continue 2026-2027", "Le Secrétaire général présente le programme de formation continue : déontologie, procédure OHADA, contentieux du travail. L'assemblée l'adopte et invite les confrères à s'y inscrire avant le 30 novembre 2026.", 47, 0, 1],
    ["Questions diverses", "Les membres évoquent l'aménagement de la salle des pas perdus et la permanence des avocats commis d'office. Ces points sont renvoyés au Conseil de l'Ordre pour examen.", 0, 0, 0],
  ];
  return {
    nom: "pv", titreCourt: "Procès-verbal d'assemblée générale", ref, unePage: false,
    contenu: `${entete("Procès-verbal n°", ref, `Transmis le ${fmtDateFr(transmis)}`)}<main>
${titre("Assemblée générale ordinaire", "Procès-verbal")}
<p class="sous-titre">Séance du ${fmtDateFr(seance)}, Maison de l'Avocat, ${esc(ID.ville)}.</p>
<dl class="meta"><div><dt>Date de la séance</dt><dd>${fmtDateFr(seance)}, 9 h 30</dd></div><div><dt>Président de séance</dt><dd>${esc(ID.batonnier)}, Bâtonnier</dd></div><div><dt>Secrétaire de séance</dt><dd>${esc(ID.sg)}</dd></div>
<div><dt>Quorum</dt><dd>48 présents ou représentés sur 72 inscrits</dd></div><div><dt>Date de transmission</dt><dd>${fmtDateFr(transmis)}</dd></div><div><dt>Destinataire</dt><dd>Conseil de l'Ordre national</dd></div></dl>
<h2 class="section">Ordre du jour</h2>
<ol class="odj">${resolutions.map(([t]) => `<li>${esc(t)}</li>`).join("")}</ol>
<h2 class="section">Délibérations</h2>
<div class="corps"><p>La séance est ouverte à 9 h 30 sous la présidence du Bâtonnier. Le quorum étant atteint, l'assemblée peut valablement délibérer sur les points inscrits à l'ordre du jour.</p>
${resolutions.map(([t, texte], i) => `<p><b>${i + 1}. ${esc(t)}.</b> ${esc(texte)}</p>`).join("")}
<p>L'ordre du jour étant épuisé, la séance est levée à 12 h 45.</p></div>
<h2 class="section">Résultat des votes</h2>
<table><thead><tr><th>Résolution</th><th class="num">Pour</th><th class="num">Contre</th><th class="num">Abstention</th><th>Décision</th></tr></thead>
<tbody>${resolutions.filter((r) => r[2] + r[3] + r[4] > 0).map(([t, , p, c, a], i) => `<tr><td>${i + 1}. ${esc(t)}</td><td class="num">${p}</td><td class="num">${c}</td><td class="num">${a}</td><td>${p > c ? "Adoptée" : "Rejetée"}</td></tr>`).join("")}</tbody></table>
<div class="corps"><p>Le présent procès-verbal a été transmis au Conseil de l'Ordre national le ${fmtDateFr(transmis)}, conformément à l'article 23 de la loi n° 026-92 du 20 août 1992.</p></div>
<div class="cloture"><p class="fait-a">Fait à ${esc(ID.ville)}, le ${fmtDateFr(seance)}.</p>
${signatures([["Le Président de séance", ID.batonnier], ["Le Secrétaire de séance", ID.sg]])}</div></main>`,
  };
}

// ---------- Contrôle des PDF (sans dépendance : lecture des MediaBox) ----------
/** Pages et dimensions en mm lues dans le PDF produit par Chrome. Chrome range les objets
 *  page dans des flux compressés : on décompresse chaque flux (zlib) avant de chercher les MediaBox. */
export function pagesPdf(pdf: Uint8Array): { w: number; h: number }[] {
  let brut = Buffer.from(pdf).toString("latin1"); // page.pdf() renvoie un Uint8Array, pas un Buffer
  for (const m of brut.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try { brut += inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { /* flux non zlib (image, police) */ }
  }
  return [...brut.matchAll(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/g)].map((m) => ({ w: (+m[1] * 25.4) / 72, h: (+m[2] * 25.4) / 72 }));
}

async function main() {
  fs.mkdirSync(APERCUS, { recursive: true });
  const docs = [await quitus(), await recu(), await timbre(), await attestation(), liste(), pv()];
  const erreurs: string[] = [];
  for (const direction of Object.keys(DIRECTIONS)) {
    fs.mkdirSync(path.join(HTML, direction), { recursive: true });
    for (const d of docs) {
      const html = assembler(direction, d);
      fs.writeFileSync(path.join(HTML, direction, `${d.nom}.html`), html);
      const pdf = await htmlVersPdf(html);
      fs.writeFileSync(path.join(APERCUS, `${direction}-${d.nom}.pdf`), pdf);
      const pages = pagesPdf(pdf);
      const a4 = pages.length > 0 && pages.every((p) => Math.abs(p.w - 210) < 1 && Math.abs(p.h - 297) < 1);
      if (!a4) erreurs.push(`${direction}-${d.nom} : format non A4`);
      if (d.unePage && pages.length !== 1) erreurs.push(`${direction}-${d.nom} : ${pages.length} pages au lieu d'une`);
      if (d.nom === "liste" && pages.length < 2) erreurs.push(`${direction}-liste : une seule page, la pagination n'est pas démontrée`);
      console.log(`${direction}-${d.nom}.pdf  ${pages.length} page(s)  ${a4 ? "A4 210x297" : "NON A4"}`);
    }
  }
  if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
  process.exit(0); // le navigateur Puppeteer partagé garde le processus ouvert
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) void main();
