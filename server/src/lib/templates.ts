/** Gabarits HTML des documents officiels (rendus en PDF par Puppeteer). */

import { esc as escapeHtml, fmtDateFr as fmtDate } from "./documentsCommun.js";
import { identite } from "./identiteDocuments.js";
import { cachetPourRole } from "./cachets.js";

/**
 * Logo officiel des documents — source unique (Paramètres). Si un logo a été
 * téléversé (data URI image), il est utilisé partout ; sinon on rend le sceau
 * dessiné (balance) dont le texte reprend la dénomination / l'ordre configurés.
 */
function sceau(): string {
  const id = identite();
  if (id.logo) return `<img src="${id.logo}" alt="Logo" style="width:84px;height:84px;object-fit:contain" />`;
  return `
<svg width="84" height="84" viewBox="0 0 100 100">
  <defs>
    <path id="h" d="M 18,50 A 32,32 0 0 1 82,50" />
    <path id="b" d="M 82,52 A 32,32 0 0 1 18,52" />
  </defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" stroke-width="1.4" />
  <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" stroke-width="0.6" />
  <text fill="#1A3A6B" font-size="6" font-weight="600" letter-spacing="0.8"><textPath href="#h" startOffset="50%" text-anchor="middle">${escapeHtml(id.ordre.toUpperCase())}</textPath></text>
  <text fill="#1A3A6B" font-size="6" font-weight="600" letter-spacing="0.8"><textPath href="#b" startOffset="50%" text-anchor="middle">${escapeHtml(id.denomination.toUpperCase())}</textPath></text>
  <g stroke="#1A3A6B" stroke-width="1.4" fill="none" stroke-linecap="round">
    <line x1="50" y1="37" x2="50" y2="63" /><line x1="44" y1="63" x2="56" y2="63" /><line x1="38" y1="42" x2="62" y2="42" />
    <line x1="38" y1="42" x2="38" y2="49" /><path d="M33,49 Q38,54 43,49" />
    <line x1="62" y1="42" x2="62" y2="49" /><path d="M57,49 Q62,54 67,49" />
  </g>
</svg>`;
}

interface DocOptions {
  org: string;
  title: string;
  reference?: string;
  bodyHtml: string;
  signataire: { role: string; nom: string };
  date: Date | string;
}

export function documentHtml({ org, title, reference, bodyHtml, signataire, date }: DocOptions): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@400;500;600&family=DM+Mono&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'DM Sans',sans-serif; color:#1C1C18; }
  .doc { border:1px solid #E0DBD0; border-radius:6px; overflow:hidden; }
  .head { background:#1A3A6B; padding:14px 22px; }
  .head .org { color:#C4990A; font-size:11px; font-weight:600; letter-spacing:2px; text-transform:uppercase; }
  .head .sub { color:rgba(255,255,255,.6); font-size:10px; }
  .bar { height:3px; background:linear-gradient(90deg,#C4990A,#e8bc3a,#C4990A); }
  .body { padding:30px 34px; }
  .title { font-family:'Playfair Display',serif; font-size:26px; color:#1A3A6B; text-align:center; }
  .ref { font-family:'DM Mono',monospace; font-size:12px; color:#C4990A; text-align:center; margin:4px 0 22px; }
  .content { font-size:14px; line-height:1.9; }
  .content h3 { font-family:'Playfair Display',serif; color:#1A3A6B; font-size:16px; margin:14px 0 4px; }
  .content h4 { font-weight:600; margin:10px 0 4px; }
  .content ul { margin:6px 0 6px 20px; list-style:disc; }
  .content ol { margin:6px 0 6px 20px; list-style:decimal; }
  .content li { margin:2px 0; }
  .content p { margin:0 0 8px; }
  .content b,.content strong{font-weight:700;} .content i,.content em{font-style:italic;} .content u{text-decoration:underline;}
  .montant { background:#FDF6E3; border:1px solid #E9DFBD; border-radius:4px; padding:12px 16px; margin:14px 0; text-align:center; }
  .montant b { font-family:'Playfair Display',serif; font-size:19px; color:#1A3A6B; }
  .montant i { display:block; font-size:12px; color:#7A756A; margin-top:2px; }
  .row { display:flex; justify-content:space-between; border-bottom:1px dashed #E0DBD0; padding:7px 0; font-size:14px; }
  .row .l { color:#7A756A; }
  .foot { display:flex; align-items:flex-end; justify-content:space-between; margin-top:34px; }
  .foot .date { font-size:12px; color:#7A756A; }
  .sign { text-align:right; }
  .sign .role { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#7A756A; margin-bottom:34px; }
  .sign .nom { border-top:1px solid #E0DBD0; padding-top:4px; font-size:12px; font-weight:600; color:#1A3A6B; }
  .mention { border-top:1px solid #E0DBD0; padding:8px 34px; text-align:center; font-size:8px; letter-spacing:2px; text-transform:uppercase; color:#7A756A; }
</style></head><body>
  <div class="doc">
    <div class="head"><div class="org">${escapeHtml(identite().denomination)}</div><div class="sub">${escapeHtml(identite().ordre)} · ${org}</div></div>
    <div class="bar"></div>
    <div class="body">
      <div class="title">${title}</div>
      ${reference ? `<div class="ref">${reference}</div>` : '<div style="margin-bottom:18px"></div>'}
      <div class="content">${bodyHtml}</div>
      <div class="foot">
        <div style="display:flex;align-items:flex-end;gap:12px">${sceau()}<div class="date">Fait à Pointe-Noire,<br>le ${fmtDate(date)}</div></div>
        <div class="sign"><div class="role">${signataire.role}</div>${(() => { const c = cachetPourRole(signataire.role); return c ? `<img src="${c}" alt="Cachet officiel" style="display:block;margin:2px 0 -18px auto;width:92px;height:92px;object-fit:contain" />` : ""; })()}<div class="nom">${signataire.nom}</div></div>
      </div>
    </div>
    <div class="mention">Document officiel · ${escapeHtml(identite().ordre)} · ${escapeHtml(identite().denomination)}</div>
  </div>
</body></html>`;
}

const liste = (items: string[]) =>
  `<ol style="margin:6px 0 0 18px">${items.map((p) => `<li style="margin:2px 0">${escapeHtml(p)}</li>`).join("")}</ol>`;

const QUALITE_TABLEAU: Record<string, string> = { AVOCAT: "Avocats", STAGIAIRE: "Avocats stagiaires", HONORAIRE: "Avocats honoraires" };
const MENTION_STATUT: Record<string, string> = { SUSPENDU: "Suspendu", OMIS: "Omis" };

/** Composition du Conseil de l'Ordre présentée à un instant donné (en-tête du tableau). */
export interface ConseilPdf {
  batonnier?: string | null;
  bureau: { fonction: string; sigle?: string | null; nom: string }[];
  membres: string[];
}
/** Personne morale (convention déposée) figurant en section III du tableau. */
export interface CabinetPdf {
  num: string;
  nom: string;
  forme?: string | null;
  titulaire?: string | null;
  effectif: number;
}

/** Bloc « Conseil de l'Ordre » imprimé en tête du tableau officiel. */
function conseilBloc(conseil?: ConseilPdf): string {
  if (!conseil || (!conseil.batonnier && conseil.bureau.length === 0 && conseil.membres.length === 0)) return "";
  const bat = conseil.batonnier
    ? `<div style="text-align:center;margin-bottom:8px"><div style="font-size:8.5px;text-transform:uppercase;letter-spacing:1.5px;color:#7A756A">Bâtonnier de l'Ordre</div><b style="font-family:'Playfair Display',serif;font-size:15px;color:#1A3A6B">${escapeHtml(conseil.batonnier)}</b></div>`
    : "";
  const bureau = conseil.bureau.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:8px">${conseil.bureau
        .map((b) => `<div style="text-align:center;background:#fff;border:1px solid #E9DFBD;border-radius:5px;padding:5px 10px;min-width:120px"><div style="font-size:8.5px;color:#C4990A;font-weight:600;text-transform:uppercase;letter-spacing:.4px">${escapeHtml(b.fonction)}${b.sigle ? ` (${escapeHtml(b.sigle)})` : ""}</div><div style="font-size:12px;font-weight:600;color:#1A3A6B">${escapeHtml(b.nom)}</div></div>`)
        .join("")}</div>`
    : "";
  const membres = conseil.membres.length
    ? `<div style="font-size:11px;color:#4a4a44;text-align:center;line-height:1.6"><span style="font-size:8.5px;text-transform:uppercase;letter-spacing:1px;color:#7A756A">Membres — </span>${conseil.membres.map((m) => escapeHtml(m)).join(" · ")}</div>`
    : "";
  return `<div style="background:#FDF6E3;border:1px solid #E9DFBD;border-radius:6px;padding:12px 16px;margin:2px 0 18px">
    <div style="text-align:center;font-family:'Playfair Display',serif;color:#1A3A6B;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Conseil de l'Ordre</div>
    ${bat}${bureau}${membres}</div>`;
}

/** Section « personnes morales » (conventions déposées) — intro + table, sans titre. */
function cabinetsTable(cabinets: CabinetPdf[]): string {
  return `<p style="font-size:10.5px;color:#7A756A;margin:0 0 6px">Cabinets, sociétés et associations d'avocats ayant déposé leur convention à l'Ordre.</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="border-bottom:1.5px solid #1A3A6B;color:#7A756A;text-align:left">
        <th style="padding:5px 6px;width:42px">N°</th><th style="padding:5px 6px">Dénomination</th><th style="padding:5px 6px">Titulaire</th><th style="padding:5px 6px;width:150px">Forme</th><th style="padding:5px 6px;width:64px;text-align:center">Effectif</th></tr></thead>
      <tbody>${cabinets.map((c) => `<tr style="border-bottom:1px solid #E0DBD0">
        <td style="padding:5px 6px;font-family:'DM Mono',monospace;color:#C4990A">${escapeHtml(c.num)}</td>
        <td style="padding:5px 6px"><b>${escapeHtml(c.nom)}</b></td>
        <td style="padding:5px 6px;color:#7A756A">${c.titulaire ? "Me " + escapeHtml(c.titulaire) : "—"}</td>
        <td style="padding:5px 6px;color:#7A756A">${c.forme ? escapeHtml(c.forme) : "—"}</td>
        <td style="padding:5px 6px;text-align:center;font-family:'DM Mono',monospace;color:#1A3A6B">${c.effectif}</td></tr>`).join("")}</tbody>
    </table>`;
}

/**
 * Tableau de l'Ordre — document officiel : Conseil de l'Ordre en en-tête, sections
 * par qualité (avocats, stagiaires, honoraires), personnes morales, signature du Bâtonnier.
 */
export function tableauOrdreHtml(
  sections: { qualite: string; membres: any[] }[],
  date: Date | string,
  extras?: { conseil?: ConseilPdf; cabinets?: CabinetPdf[] },
): string {
  const numRomain = ["I", "II", "III", "IV"];
  const section = (s: { qualite: string; membres: any[] }, i: number) => `
    <h3 style="font-family:'Playfair Display',serif;color:#1A3A6B;font-size:16px;margin:18px 0 6px"><span style="color:#C4990A">${numRomain[i] ?? i + 1}.</span> ${QUALITE_TABLEAU[s.qualite] ?? s.qualite} <span style="font-size:11px;color:#7A756A">(${s.membres.length})</span></h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="border-bottom:1.5px solid #1A3A6B;color:#7A756A;text-align:left">
        <th style="padding:5px 6px;width:42px">N°</th><th style="padding:5px 6px">Nom</th><th style="padding:5px 6px">Cabinet</th><th style="padding:5px 6px;width:120px">Inscription</th></tr></thead>
      <tbody>${s.membres.map((m) => `<tr style="border-bottom:1px solid #E0DBD0">
        <td style="padding:5px 6px;font-family:'DM Mono',monospace;color:#C4990A">${m.rang}</td>
        <td style="padding:5px 6px"><b>Me ${escapeHtml(m.nom)}</b>${MENTION_STATUT[m.statut] ? ` <span style="font-size:9px;color:#b3261e">(${MENTION_STATUT[m.statut]})</span>` : ""}</td>
        <td style="padding:5px 6px;color:#7A756A">${m.cabinet ? escapeHtml(m.cabinet) : "—"}</td>
        <td style="padding:5px 6px;color:#7A756A">${m.dateInscription ? fmtDate(m.dateInscription) : "—"}</td></tr>`).join("")}</tbody>
    </table>`;
  const cabinetsSection = extras?.cabinets?.length
    ? `<h3 style="font-family:'Playfair Display',serif;color:#1A3A6B;font-size:16px;margin:18px 0 6px"><span style="color:#C4990A">${numRomain[sections.length] ?? sections.length + 1}.</span> Personnes morales <span style="font-size:11px;color:#7A756A">(${extras.cabinets.length})</span></h3>${cabinetsTable(extras.cabinets)}`
    : "";
  const signataire = extras?.conseil?.batonnier || identite().batonnier;
  const nbInscrits = sections.reduce((n, s) => n + s.membres.length, 0);
  const nbPM = extras?.cabinets?.length ?? 0;
  const contexte = `<div style="text-align:center;font-size:11px;color:#7A756A;margin:-10px 0 18px">${nbInscrits} inscrit${nbInscrits > 1 ? "s" : ""} au tableau · ${nbPM} personne${nbPM > 1 ? "s" : ""} morale${nbPM > 1 ? "s" : ""} · arrêté au ${fmtDate(date)}</div>`;
  return documentHtml({
    org: "Le Bâtonnier",
    title: "Tableau de l'Ordre",
    reference: `Arrêté au ${fmtDate(date)}`,
    bodyHtml: `${contexte}${conseilBloc(extras?.conseil)}<p style="margin-bottom:4px">Tableau de l'Ordre des Avocats du Barreau de Pointe-Noire, dressé par ordre d'ancienneté.</p>${sections.map(section).join("")}${cabinetsSection}`,
    signataire: { role: "Le Bâtonnier", nom: signataire },
    date,
  });
}

export function attestationHtml(membre: { nom: string; num: number; dateInscription?: Date | string | null }, numero: string, date: Date | string): string {
  const depuis = membre.dateInscription ? `, depuis le <b>${fmtDate(membre.dateInscription)}</b>` : "";
  return documentHtml({
    org: "Le Bâtonnier",
    title: "Attestation d'inscription",
    reference: `N° ${numero}`,
    bodyHtml: `
      <p>Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que <b>Me ${escapeHtml(membre.nom)}</b> est inscrit(e) au Tableau de l'Ordre des Avocats du Barreau de Pointe-Noire sous le numéro <b>${membre.num}</b>${depuis}.</p>
      <p style="margin-top:12px">La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>`,
    signataire: { role: "Le Bâtonnier", nom: identite().batonnier },
    date,
  });
}

/** Attestation de non-redevance (cotisation de l'exercice intégralement réglée). */
export function attestationNonRedevanceHtml(
  membre: { nom: string; num: number },
  numero: string,
  annee: number,
  date: Date | string,
): string {
  return documentHtml({
    org: "Le Bâtonnier",
    title: "Attestation de non-redevance",
    reference: `N° ${numero}`,
    bodyHtml: `
      <p>Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que <b>Me ${escapeHtml(membre.nom)}</b>, inscrit(e) au Tableau de l'Ordre sous le numéro <b>${membre.num}</b>, est à jour de sa cotisation ordinale au titre de l'exercice <b>${annee}</b>.</p>
      <p style="margin-top:12px">L'intéressé(e) ne demeure redevable d'aucune somme envers l'Ordre au titre de cet exercice. La présente attestation est délivrée pour servir et valoir ce que de droit.</p>`,
    signataire: { role: "Le Bâtonnier", nom: identite().batonnier },
    date,
  });
}

export function convocationReunionHtml(reunion: any): string {
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Convocation",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `
      <p>Le Bâtonnier a l'honneur de convier Mesdames et Messieurs les membres du Conseil de l'Ordre à la réunion qui se tiendra le <b>${fmtDate(reunion.date)}</b>${reunion.heure ? ` à <b>${escapeHtml(reunion.heure)}</b>` : ""}, au <b>${escapeHtml(reunion.lieu ?? "—")}</b>.</p>
      <p style="margin-top:10px"><b>Ordre du jour :</b></p>${liste(reunion.ordreDuJour ?? [])}`,
    signataire: { role: "Le Bâtonnier", nom: identite().batonnier },
    date: reunion.date,
  });
}

export function feuillePresenceHtml(reunion: any): string {
  const id = identite();
  const membres = [
    `${id.batonnier} — Bâtonnier`,
    `${id.tresoriere} — Trésorière`,
    `${id.secretaireGeneral} — Secrétaire Général`,
    "", "", "",
  ];
  const lignes = membres
    .map((n) => `<tr><td style="padding:10px 0;border-bottom:1px solid #E0DBD0">${escapeHtml(n)}</td><td style="border-bottom:1px solid #E0DBD0"></td></tr>`)
    .join("");
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Feuille de présence",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `<table style="width:100%;font-size:13px"><thead><tr><th style="text-align:left;border-bottom:1px solid #1A3A6B;color:#1A3A6B;padding-bottom:4px">Membre</th><th style="text-align:right;border-bottom:1px solid #1A3A6B;color:#1A3A6B">Émargement</th></tr></thead><tbody>${lignes}</tbody></table>`,
    signataire: { role: "Le Secrétaire Général", nom: identite().secretaireGeneral },
    date: reunion.date,
  });
}

export function convocationAgHtml(a: any): string {
  const type = a.type === "AGE" ? "Assemblée Générale Extraordinaire" : "Assemblée Générale Ordinaire";
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Convocation à l'Assemblée Générale",
    reference: `${a.type} du ${fmtDate(a.date)}`,
    bodyHtml: `
      <p>Le Bâtonnier convoque l'ensemble des membres du corps électoral à l'<b>${type}</b> qui se tiendra le <b>${fmtDate(a.date)}</b>, au <b>${escapeHtml(a.lieu ?? "—")}</b>.</p>
      <p style="margin-top:10px"><b>Ordre du jour :</b></p>${liste(a.ordreDuJour ?? [])}`,
    signataire: { role: "Le Bâtonnier", nom: identite().batonnier },
    date: a.date,
  });
}

export function convocationDisciplineHtml(d: any): string {
  const qui = d.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${escapeHtml(d.avocatNom)}`;
  const quand = d.dateAudience ? `, le <b>${fmtDate(d.dateAudience)}</b>` : "";
  return documentHtml({
    org: "Conseil de discipline",
    title: "Convocation disciplinaire",
    reference: `Dossier N° ${d.reference}`,
    bodyHtml: `
      <p>Dans le cadre du dossier disciplinaire <b>N° ${d.reference}</b>, <b>${qui}</b> est invité(e) à comparaître devant le Conseil de discipline de l'Ordre des Avocats du Barreau de Pointe-Noire${quand}.</p>
      <p style="margin-top:10px">Objet : ${escapeHtml(d.objet ?? "—")}.</p>
      <p style="margin-top:10px;font-size:12px;color:#7A756A">L'intéressé(e) pourra se faire assister du conseil de son choix et consulter le dossier au Secrétariat de l'Ordre.</p>`,
    signataire: { role: "Le Bâtonnier, Président du Conseil de discipline", nom: identite().batonnier },
    date: new Date(),
  });
}

/**
 * Corps de PV : rend le HTML riche (assaini) si le contenu est balisé, sinon
 * traite le texte brut en paragraphes (rétrocompatible avec les anciens PV).
 * Assainissement défensif : le front assainit déjà à la saisie (allowlist stricte) ;
 * on retire ici tout <script>/<style>, gestionnaire on… et URL javascript:.
 */
const assainirHtmlServeur = (html: string) =>
  html
    .replace(/<\/?(?:script|style)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
const corpsPv = (texte?: string | null) =>
  texte && /<[a-z][\s\S]*>/i.test(texte) ? assainirHtmlServeur(texte) : paragraphes(texte);

/** Rend un texte libre (PV, décision) en paragraphes HTML échappés. */
const paragraphes = (texte?: string | null) =>
  (texte ?? "")
    .split(/\n{2,}/)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => `<p style="margin:0 0 10px">${escapeHtml(bloc).replace(/\n/g, "<br>")}</p>`)
    .join("") || '<p style="color:#7A756A">— Procès-verbal non encore rédigé —</p>';

/** Titre de section numéroté d'un procès-verbal structuré. */
const sectionPv = (num: string, texte: string) =>
  `<h3 style="font-family:'Playfair Display',serif;color:#1A3A6B;font-size:15px;margin:16px 0 6px"><span style="color:#C4990A">${num}.</span> ${texte}</h3>`;

/**
 * Section « Présences et quorum » à partir de la feuille émargée {label: présent}.
 * Le quorum est atteint dès que la moitié au moins des membres est présente.
 */
function presenceEtQuorum(presences: Record<string, boolean> | null | undefined): string {
  const entrees = Object.entries(presences ?? {});
  if (entrees.length === 0) return `<p style="color:#7A756A">Feuille de présence à compléter.</p>`;
  const presents = entrees.filter(([, v]) => v).map(([n]) => escapeHtml(n));
  const absents = entrees.filter(([, v]) => !v).map(([n]) => escapeHtml(n));
  const total = entrees.length;
  const quorum = presents.length * 2 >= total;
  return `
    <div class="row"><span class="l">Membres présents (${presents.length})</span><span>${presents.length ? presents.join(", ") : "—"}</span></div>
    <div class="row"><span class="l">Membres absents (${absents.length})</span><span>${absents.length ? absents.join(", ") : "—"}</span></div>
    <p style="margin:8px 0 0">Sur <b>${total}</b> membres composant le Conseil, <b>${presents.length}</b> sont présents. ${quorum
      ? "La moitié au moins des membres étant présente, le <b>quorum est atteint</b> et le Conseil peut valablement délibérer."
      : "Le <b>quorum n'est pas atteint</b> ; le Conseil sera de nouveau convoqué sur les points concernés."}</p>`;
}

/**
 * Procès-verbal de réunion du Conseil de l'Ordre (CDC §2.9 / §6), structuré
 * selon le modèle officiel : le squelette et les formules sont composés
 * automatiquement, l'utilisateur ne saisit que les variables (présences, ODJ,
 * délibérations). Sections I→V, signature du Secrétaire Général avec cachet.
 */
export function pvReunionHtml(reunion: any): string {
  const odj = (reunion.ordreDuJour ?? []).length
    ? liste(reunion.ordreDuJour)
    : '<p style="color:#7A756A">Ordre du jour non renseigné.</p>';
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Procès-verbal de réunion",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `
      ${sectionPv("I", "Convocation et ouverture de la séance")}
      <p>L'an ${new Date(reunion.date).getFullYear()}, le <b>${fmtDate(reunion.date)}</b>${reunion.heure ? ` à <b>${escapeHtml(reunion.heure)}</b>` : ""}, le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire, régulièrement convoqué par le Bâtonnier, s'est réuni${reunion.lieu ? ` au <b>${escapeHtml(reunion.lieu)}</b>` : ""}. La séance est présidée par le Bâtonnier.</p>
      ${sectionPv("II", "Présences et vérification du quorum")}
      ${presenceEtQuorum(reunion.presences)}
      ${sectionPv("III", "Ordre du jour")}
      ${odj}
      ${sectionPv("IV", "Délibérations et décisions")}
      ${corpsPv(reunion.pv)}
      ${sectionPv("V", "Clôture")}
      <p>Plus rien n'étant inscrit à l'ordre du jour, la séance est levée. Le présent procès-verbal est dressé pour être soumis à l'approbation du Conseil.</p>`,
    signataire: { role: "Le Secrétaire Général", nom: identite().secretaireGeneral },
    date: reunion.date,
  });
}

/** Procès-verbal d'assemblée générale (CDC §2.10 / §6), structuré (sections I→V). */
export function pvAssembleeHtml(a: any): string {
  const type = a.type === "AGE" ? "Assemblée Générale Extraordinaire" : "Assemblée Générale Ordinaire";
  const odj = (a.ordreDuJour ?? []).length ? liste(a.ordreDuJour) : '<p style="color:#7A756A">Ordre du jour non renseigné.</p>';
  const decisions = (a.decisions ?? []).length
    ? `<p style="margin:12px 0 4px"><b>Décisions adoptées :</b></p>${liste(a.decisions)}`
    : "";
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Procès-verbal d'Assemblée Générale",
    reference: `${a.type} du ${fmtDate(a.date)}`,
    bodyHtml: `
      ${sectionPv("I", "Ouverture de la séance")}
      <p>L'an ${new Date(a.date).getFullYear()}, le <b>${fmtDate(a.date)}</b>, les membres du Barreau de Pointe-Noire se sont réunis en <b>${type}</b>${a.lieu ? ` au <b>${escapeHtml(a.lieu)}</b>` : ""}, sous la présidence du Bâtonnier.</p>
      ${sectionPv("II", "Quorum")}
      <p>Nombre de membres présents : <b>${a.quorumPresent ?? 0}</b>.</p>
      ${sectionPv("III", "Ordre du jour")}
      ${odj}
      ${sectionPv("IV", "Délibérations et décisions")}
      ${corpsPv(a.pv)}
      ${decisions}
      ${sectionPv("V", "Clôture")}
      <p>L'ordre du jour étant épuisé, la séance est levée. Le présent procès-verbal est dressé pour servir et valoir ce que de droit.</p>`,
    signataire: { role: "Le Bâtonnier", nom: identite().batonnier },
    date: a.date,
  });
}

/** Procès-verbal de scrutin (élections du Conseil / Bâtonnier) — résultats officiels. */
export function pvScrutinHtml(s: any): string {
  const TYPE_LABEL: Record<string, string> = { CONSEIL: "Conseil de l'Ordre", BATONNIER: "Bâtonnier", AUTRE: "Scrutin" };
  const MODALITE_LABEL: Record<string, string> = { PRESENTIEL: "Présentiel", EN_LIGNE: "Vote en ligne" };
  const candidats = [...(s.candidats ?? [])].sort((a: any, b: any) => b.voix - a.voix || a.nom.localeCompare(b.nom));
  const total = candidats.reduce((n: number, c: any) => n + c.voix, 0);
  const lignes = candidats
    .map((c: any, i: number) => {
      const pct = total > 0 ? Math.round((c.voix / total) * 100) : 0;
      const elu = s.type === "CONSEIL" && i < s.nbSieges && c.voix > 0;
      return `<tr style="border-bottom:1px solid #E0DBD0">
        <td style="padding:6px 6px;font-family:'DM Mono',monospace;color:#C4990A">${i + 1}</td>
        <td style="padding:6px 6px"><b>${escapeHtml(c.nom)}</b>${elu ? ` <span style="font-size:9px;color:#2f855a">(Élu·e)</span>` : ""}</td>
        <td style="padding:6px 6px;text-align:right;font-family:'DM Mono',monospace;color:#1A3A6B">${c.voix}</td>
        <td style="padding:6px 6px;text-align:right;color:#7A756A">${pct}%</td></tr>`;
    })
    .join("");
  return documentHtml({
    org: "Le Secrétaire Général",
    title: "Procès-verbal du scrutin",
    reference: escapeHtml(s.titre),
    bodyHtml: `
      <div class="row"><span class="l">Type de scrutin</span><span>${TYPE_LABEL[s.type] ?? s.type}</span></div>
      <div class="row"><span class="l">Modalité</span><span>${MODALITE_LABEL[s.modalite] ?? s.modalite}</span></div>
      <div class="row"><span class="l">Sièges à pourvoir</span><span>${s.nbSieges}</span></div>
      <div class="row"><span class="l">Suffrages exprimés</span><span>${total}${s._count?.emargements != null ? ` · ${s._count.emargements} votant(s)` : ""}</span></div>
      <p style="margin:16px 0 4px"><b>Résultats :</b></p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="border-bottom:1.5px solid #1A3A6B;color:#7A756A;text-align:left">
          <th style="padding:5px 6px;width:42px">Rang</th><th style="padding:5px 6px">Candidat</th><th style="padding:5px 6px;text-align:right;width:80px">Voix</th><th style="padding:5px 6px;text-align:right;width:64px">%</th></tr></thead>
        <tbody>${lignes || '<tr><td colspan="4" style="padding:8px;color:#7A756A">Aucun candidat.</td></tr>'}</tbody>
      </table>
      <p style="margin-top:16px;font-size:12px;color:#7A756A">Procès-verbal dressé à l'issue du dépouillement${s.closLe ? ` (clôture le ${fmtDate(s.closLe)})` : ""}.</p>`,
    signataire: { role: "Le Secrétaire Général", nom: identite().secretaireGeneral },
    date: s.closLe ?? new Date(),
  });
}

/** Décision disciplinaire (CDC §2.11 / §6 — PDF sécurisé). */
export function decisionDisciplineHtml(d: any): string {
  const qui = d.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${escapeHtml(d.avocatNom)}`;
  const sanction = d.sanction
    ? `<div class="montant"><b>${escapeHtml(d.sanction)}</b><i>Sanction prononcée</i></div>`
    : "";
  return documentHtml({
    org: "Conseil de discipline",
    title: "Décision disciplinaire",
    reference: `Dossier N° ${d.reference}`,
    bodyHtml: `
      <p>Le Conseil de discipline de l'Ordre des Avocats du Barreau de Pointe-Noire, statuant sur le dossier <b>N° ${d.reference}</b> concernant <b>${qui}</b>${d.dateAudience ? `, à la suite de l'audience du <b>${fmtDate(d.dateAudience)}</b>` : ""},</p>
      <p style="margin:10px 0 4px"><b>Objet :</b> ${escapeHtml(d.objet ?? "—")}.</p>
      <p style="margin:14px 0 4px"><b>Décision :</b></p>
      ${corpsPv(d.decision)}
      ${sanction}`,
    signataire: { role: "Le Bâtonnier, Président du Conseil de discipline", nom: identite().batonnier },
    date: new Date(),
  });
}
