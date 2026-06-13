/** Gabarits HTML des documents officiels (rendus en PDF par Puppeteer). */

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

export function recuHtml(recu: any, membre: { nom: string }): string {
  return documentHtml({
    org: "Trésorerie Générale",
    title: `Reçu N° ${recu.numero}`,
    bodyHtml: `
      <div class="row"><span class="l">Reçu de Me</span><span><b>${membre.nom}</b></span></div>
      <div class="montant"><b>${fmtFCFA(recu.montant)}</b></div>
      <div class="row"><span class="l">Pour</span><span>Cotisation ordinale ${recu.annee}</span></div>
      <div class="row"><span class="l">Mode de paiement</span><span>${recu.mode ?? "—"}</span></div>`,
    signataire: { role: "La Trésorière", nom: "Me ONDZE BOYA" },
    date: recu.date,
  });
}

export function quitusHtml(quitus: any, membre: { nom: string }): string {
  return documentHtml({
    org: "Conseil de l'Ordre",
    title: "Quitus de cotisation",
    reference: `N° ${quitus.numero}`,
    bodyHtml: `
      <p>Le Conseil de l'Ordre des Avocats du Barreau de Pointe-Noire certifie que <b>Me ${membre.nom}</b>, avocat inscrit au tableau, est <b>entièrement à jour</b> de ses cotisations ordinales au titre de l'exercice <b>${quitus.annee}</b>.</p>
      <p style="margin-top:12px">En foi de quoi le présent quitus lui est délivré pour servir et valoir ce que de droit.</p>`,
    signataire: { role: "La Trésorière", nom: "Me ONDZE BOYA" },
    date: quitus.dateEmission,
  });
}
