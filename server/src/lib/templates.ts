/** Gabarits HTML des documents officiels (rendus en PDF par Puppeteer). */

import { montantEnLettresFCFA } from "./montantEnLettres.js";

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

const fmtFCFA = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

/** Sceau officiel (SVG) — balance entourée de la dénomination. */
const SCEAU = `
<svg width="84" height="84" viewBox="0 0 100 100">
  <defs>
    <path id="h" d="M 18,50 A 32,32 0 0 1 82,50" />
    <path id="b" d="M 82,52 A 32,32 0 0 1 18,52" />
  </defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" stroke-width="1.4" />
  <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" stroke-width="0.6" />
  <text fill="#1A3A6B" font-size="6.5" font-weight="600" letter-spacing="1.1"><textPath href="#h" startOffset="50%" text-anchor="middle">ORDRE NATIONAL DES AVOCATS</textPath></text>
  <text fill="#1A3A6B" font-size="6.5" font-weight="600" letter-spacing="1.1"><textPath href="#b" startOffset="50%" text-anchor="middle">BARREAU DE POINTE-NOIRE</textPath></text>
  <g stroke="#1A3A6B" stroke-width="1.4" fill="none" stroke-linecap="round">
    <line x1="50" y1="37" x2="50" y2="63" /><line x1="44" y1="63" x2="56" y2="63" /><line x1="38" y1="42" x2="62" y2="42" />
    <line x1="38" y1="42" x2="38" y2="49" /><path d="M33,49 Q38,54 43,49" />
    <line x1="62" y1="42" x2="62" y2="49" /><path d="M57,49 Q62,54 67,49" />
  </g>
</svg>`;

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
  .montant { background:#FDF6E3; border-left:3px solid #C4990A; border-radius:0 4px 4px 0; padding:12px 16px; margin:14px 0; }
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
    <div class="head"><div class="org">Barreau de Pointe-Noire</div><div class="sub">Ordre National des Avocats du Congo · ${org}</div></div>
    <div class="bar"></div>
    <div class="body">
      <div class="title">${title}</div>
      ${reference ? `<div class="ref">${reference}</div>` : '<div style="margin-bottom:18px"></div>'}
      <div class="content">${bodyHtml}</div>
      <div class="foot">
        <div style="display:flex;align-items:flex-end;gap:12px">${SCEAU}<div class="date">Fait à Pointe-Noire,<br>le ${fmtDate(date)}</div></div>
        <div class="sign"><div class="role">${signataire.role}</div><div class="nom">${signataire.nom}</div></div>
      </div>
    </div>
    <div class="mention">Document officiel · Ordre National des Avocats du Congo · Barreau de Pointe-Noire</div>
  </div>
</body></html>`;
}

const liste = (items: string[]) =>
  `<ol style="margin:6px 0 0 18px">${items.map((p) => `<li style="margin:2px 0">${p}</li>`).join("")}</ol>`;

export function attestationHtml(membre: { nom: string; num: number; dateInscription?: Date | string | null }, numero: string, date: Date | string): string {
  const depuis = membre.dateInscription ? `, depuis le <b>${fmtDate(membre.dateInscription)}</b>` : "";
  return documentHtml({
    org: "Le Bâtonnier",
    title: "Attestation d'inscription",
    reference: `N° ${numero}`,
    bodyHtml: `
      <p>Le Bâtonnier de l'Ordre des Avocats du Barreau de Pointe-Noire atteste que <b>Me ${membre.nom}</b> est inscrit(e) au Tableau de l'Ordre des Avocats du Barreau de Pointe-Noire sous le numéro <b>${membre.num}</b>${depuis}.</p>
      <p style="margin-top:12px">La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.</p>`,
    signataire: { role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" },
    date,
  });
}

export function convocationReunionHtml(reunion: any): string {
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Convocation",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `
      <p>Le Bâtonnier a l'honneur de convier Mesdames et Messieurs les membres du Conseil de l'Ordre à la réunion qui se tiendra le <b>${fmtDate(reunion.date)}</b>${reunion.heure ? ` à <b>${reunion.heure}</b>` : ""}, au <b>${reunion.lieu ?? "—"}</b>.</p>
      <p style="margin-top:10px"><b>Ordre du jour :</b></p>${liste(reunion.ordreDuJour ?? [])}`,
    signataire: { role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" },
    date: reunion.date,
  });
}

export function feuillePresenceHtml(reunion: any): string {
  const membres = [
    "Me BIKINDOU Audrey Séverin — Bâtonnier",
    "Me ONDZE BOYA Armelle Laure Carine — Trésorière",
    "Me KALINA-MENGA Lionel — Secrétaire Général",
    "", "", "",
  ];
  const lignes = membres
    .map((n) => `<tr><td style="padding:10px 0;border-bottom:1px solid #E0DBD0">${n}</td><td style="border-bottom:1px solid #E0DBD0"></td></tr>`)
    .join("");
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Feuille de présence",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `<table style="width:100%;font-size:13px"><thead><tr><th style="text-align:left;border-bottom:1px solid #1A3A6B;color:#1A3A6B;padding-bottom:4px">Membre</th><th style="text-align:right;border-bottom:1px solid #1A3A6B;color:#1A3A6B">Émargement</th></tr></thead><tbody>${lignes}</tbody></table>`,
    signataire: { role: "Le Secrétaire Général", nom: "Me KALINA-MENGA Lionel" },
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
      <p>Le Bâtonnier convoque l'ensemble des membres du corps électoral à l'<b>${type}</b> qui se tiendra le <b>${fmtDate(a.date)}</b>, au <b>${a.lieu ?? "—"}</b>.</p>
      <p style="margin-top:10px"><b>Ordre du jour :</b></p>${liste(a.ordreDuJour ?? [])}`,
    signataire: { role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" },
    date: a.date,
  });
}

export function convocationDisciplineHtml(d: any): string {
  const qui = d.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${d.avocatNom}`;
  const quand = d.dateAudience ? `, le <b>${fmtDate(d.dateAudience)}</b>` : "";
  return documentHtml({
    org: "Conseil de discipline",
    title: "Convocation disciplinaire",
    reference: `Dossier N° ${d.reference}`,
    bodyHtml: `
      <p>Dans le cadre du dossier disciplinaire <b>N° ${d.reference}</b>, <b>${qui}</b> est invité(e) à comparaître devant le Conseil de discipline de l'Ordre des Avocats du Barreau de Pointe-Noire${quand}.</p>
      <p style="margin-top:10px">Objet : ${d.objet}.</p>
      <p style="margin-top:10px;font-size:12px;color:#7A756A">L'intéressé(e) pourra se faire assister du conseil de son choix et consulter le dossier au Secrétariat de l'Ordre.</p>`,
    signataire: { role: "Le Bâtonnier, Président du Conseil de discipline", nom: "Me BIKINDOU Audrey Séverin" },
    date: new Date(),
  });
}

/** Rend un texte libre (PV, décision) en paragraphes HTML échappés. */
const paragraphes = (texte?: string | null) =>
  (texte ?? "")
    .split(/\n{2,}/)
    .map((bloc) => bloc.trim())
    .filter(Boolean)
    .map((bloc) => `<p style="margin:0 0 10px">${escapeHtml(bloc).replace(/\n/g, "<br>")}</p>`)
    .join("") || '<p style="color:#7A756A">— Procès-verbal non encore rédigé —</p>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
}

/** Procès-verbal de réunion du Conseil de l'Ordre (CDC §2.9 / §6). */
export function pvReunionHtml(reunion: any): string {
  const odj = (reunion.ordreDuJour ?? []).length
    ? `<p style="margin:10px 0 4px"><b>Ordre du jour :</b></p>${liste(reunion.ordreDuJour)}`
    : "";
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Procès-verbal de réunion",
    reference: `Réunion du ${fmtDate(reunion.date)}`,
    bodyHtml: `
      <p>L'an ${new Date(reunion.date).getFullYear()}, le <b>${fmtDate(reunion.date)}</b>${reunion.heure ? ` à <b>${reunion.heure}</b>` : ""}, le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire s'est réuni${reunion.lieu ? ` au <b>${reunion.lieu}</b>` : ""}.</p>
      ${odj}
      <p style="margin:14px 0 4px"><b>Délibérations :</b></p>
      ${paragraphes(reunion.pv)}`,
    signataire: { role: "Le Secrétaire Général", nom: "Me KALINA-MENGA Lionel" },
    date: reunion.date,
  });
}

/** Procès-verbal d'assemblée générale (CDC §2.10 / §6). */
export function pvAssembleeHtml(a: any): string {
  const type = a.type === "AGE" ? "Assemblée Générale Extraordinaire" : "Assemblée Générale Ordinaire";
  const decisions = (a.decisions ?? []).length
    ? `<p style="margin:14px 0 4px"><b>Décisions adoptées :</b></p>${liste(a.decisions)}`
    : "";
  const quorum = a.quorumPresent != null ? `<div class="row"><span class="l">Quorum présent</span><span>${a.quorumPresent}</span></div>` : "";
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Procès-verbal d'Assemblée Générale",
    reference: `${a.type} du ${fmtDate(a.date)}`,
    bodyHtml: `
      <p>L'an ${new Date(a.date).getFullYear()}, le <b>${fmtDate(a.date)}</b>, les membres du Barreau de Pointe-Noire se sont réunis en <b>${type}</b>${a.lieu ? ` au <b>${a.lieu}</b>` : ""}.</p>
      ${quorum}
      <p style="margin:14px 0 4px"><b>Délibérations :</b></p>
      ${paragraphes(a.pv)}
      ${decisions}`,
    signataire: { role: "Le Bâtonnier", nom: "Me BIKINDOU Audrey Séverin" },
    date: a.date,
  });
}

/** Décision disciplinaire (CDC §2.11 / §6 — PDF sécurisé). */
export function decisionDisciplineHtml(d: any): string {
  const qui = d.avocatNom === "Confidentiel" ? "l'avocat concerné" : `Me ${d.avocatNom}`;
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
      ${paragraphes(d.decision)}
      ${sanction}`,
    signataire: { role: "Le Bâtonnier, Président du Conseil de discipline", nom: "Me BIKINDOU Audrey Séverin" },
    date: new Date(),
  });
}

export function recuHtml(recu: any, membre: { nom: string }): string {
  return documentHtml({
    org: "Trésorerie Générale",
    title: `Reçu N° ${recu.numero}`,
    bodyHtml: `
      <div class="row"><span class="l">Reçu de Me</span><span><b>${membre.nom}</b></span></div>
      <div class="montant"><b>${fmtFCFA(recu.montant)}</b><i>Arrêté à la somme de ${montantEnLettresFCFA(recu.montant)}.</i></div>
      <div class="row"><span class="l">Pour</span><span>Cotisation ordinale ${recu.annee}</span></div>
      <div class="row"><span class="l">Mode de paiement</span><span>${recu.mode ?? "—"}</span></div>`,
    signataire: { role: "La Trésorière", nom: "Me ONDZE BOYA" },
    date: recu.date,
  });
}

export function quitusHtml(quitus: any, membre: { nom: string }, signature?: string): string {
  const blocSignature = signature
    ? `<div style="margin-top:16px;border-top:1px dashed #E0DBD0;padding-top:8px;font-size:8.5px;color:#7A756A">
         <b style="color:#1A3A6B">Signature numérique RSA-2048 / SHA-256</b> — vérifiable via la clé publique du Barreau (/api/signatures/cle-publique).<br>
         <span style="font-family:'DM Mono',monospace;color:#1A3A6B;word-break:break-all">${signature}</span>
       </div>`
    : "";
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Quitus de cotisation",
    reference: `N° ${quitus.numero}`,
    bodyHtml: `
      <p>Le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire certifie que <b>Me ${membre.nom}</b>, avocat inscrit au tableau, est <b>entièrement à jour</b> de ses cotisations ordinales au titre de l'exercice <b>${quitus.annee}</b>.</p>
      <p style="margin-top:12px">En foi de quoi le présent quitus lui est délivré pour servir et valoir ce que de droit.</p>
      ${blocSignature}`,
    signataire: { role: "La Trésorière", nom: "Me ONDZE BOYA" },
    date: quitus.dateEmission,
  });
}
