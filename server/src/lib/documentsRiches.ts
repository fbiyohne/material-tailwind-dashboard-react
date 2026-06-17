/**
 * Reproduction côté serveur (rendu Puppeteer, vectoriel A4) des documents
 * officiels riches AFFICHÉS À L'ÉCRAN : RecuDocument et QuitusDocument
 * (src/barreau/components). Même mise en page, mêmes couleurs, même habillage —
 * mais un vrai PDF (texte sélectionnable) et non une capture d'image.
 *
 * ⚠️ À garder synchronisé avec les composants React correspondants.
 */
import { montantEnLettresFCFA } from "./montantEnLettres.js";

const fmtDateFr = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

const fmtFCFA = (n: number) =>
  `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

/** Sceau officiel (balance entourée de la dénomination) — identique au composant Sceau. */
const sceau = (size: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="Sceau">
  <defs><path id="s-h" d="M 18,50 A 32,32 0 0 1 82,50"/><path id="s-b" d="M 82,52 A 32,32 0 0 1 18,52"/></defs>
  <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" stroke-width="1.4"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" stroke-width="0.6"/>
  <text fill="#1A3A6B" font-size="6.5" font-weight="600" letter-spacing="1.1"><textPath href="#s-h" startOffset="50%" text-anchor="middle">ORDRE NATIONAL DES AVOCATS</textPath></text>
  <text fill="#1A3A6B" font-size="6.5" font-weight="600" letter-spacing="1.1"><textPath href="#s-b" startOffset="50%" text-anchor="middle">BARREAU DE POINTE-NOIRE</textPath></text>
  <g stroke="#1A3A6B" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <line x1="50" y1="37" x2="50" y2="63"/><line x1="44" y1="63" x2="56" y2="63"/><line x1="38" y1="42" x2="62" y2="42"/>
    <circle cx="50" cy="38" r="1.6" fill="#C4990A" stroke="none"/>
    <line x1="38" y1="42" x2="38" y2="49"/><path d="M33,49 Q38,54 43,49"/>
    <line x1="62" y1="42" x2="62" y2="49"/><path d="M57,49 Q62,54 67,49"/>
  </g>
</svg>`;

/** Cachet circulaire (Trésorerie ou Bâtonnier). */
const cachet = (l1: string, l2: string, size = 132) => `
<svg width="${size}" height="${size}" viewBox="0 0 180 180" style="opacity:.8">
  <defs><path id="c-h-${l2}" d="M 30,90 A 60,60 0 0 1 150,90"/><path id="c-b-${l2}" d="M 150,92 A 60,60 0 0 1 30,92"/></defs>
  <circle cx="90" cy="90" r="80" fill="none" stroke="#1A3A6B" stroke-width="3"/>
  <circle cx="90" cy="90" r="66" fill="none" stroke="#1A3A6B" stroke-width="1"/>
  <text fill="#1A3A6B" font-size="12" font-weight="700" letter-spacing="1.4"><textPath href="#c-h-${l2}" startOffset="50%" text-anchor="middle">ORDRE DES AVOCATS</textPath></text>
  <text fill="#1A3A6B" font-size="10" font-weight="600" letter-spacing="1"><textPath href="#c-b-${l2}" startOffset="50%" text-anchor="middle">BARREAU DE POINTE-NOIRE</textPath></text>
  <g fill="#1A3A6B">
    <text x="90" y="86" text-anchor="middle" font-size="15" font-weight="700">${l1}</text>
    <text x="90" y="104" text-anchor="middle" font-size="15" font-weight="700">${l2}</text>
    <polygon points="62,72 66,68 70,72 66,76"/><polygon points="110,72 114,68 118,72 114,76"/>
  </g>
</svg>`;

/** Filet doré orné d'un losange central. */
const filet = (w: number) =>
  `<div class="filet" style="width:${w}px"><span>&#9670;</span></div>`;

const calendrier = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C4990A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
</svg>`;

const bandeauContact = `
<div class="band">
  <div><span class="band-l">Adresse</span><br/>Immeuble du Barreau, Avenue Charles de Gaulle<br/>Pointe-Noire — République du Congo</div>
  <div style="text-align:center"><span class="band-l">En ligne</span><br/>contact@barreau-pointe-noire.cg<br/>www.barreau-pointe-noire.cg</div>
  <div style="text-align:right"><span class="band-l">Téléphone</span><br/>+242 05 000 00 00<br/>+242 06 000 00 00</div>
</div>`;

/** Feuille de style partagée des deux documents (reproduit les classes Tailwind). */
const styles = `
<style>
  @page { size: A4 portrait; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { background:#fff; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#1C1C18; font-size:13px; }
  .doc-root { position:relative; width:794px; min-height:1123px; display:flex; flex-direction:column;
              overflow:hidden; border:2px solid #C4990A; background:#fff; }
  .inner-border { position:absolute; inset:7px; border:1px solid rgba(196,153,10,.6); pointer-events:none; }
  .corner { position:absolute; right:-64px; top:-64px; width:176px; height:176px; border-bottom-left-radius:100%; background:#0d2247; }
  .corner > div { position:absolute; inset:12px; border-bottom-left-radius:100%; border:3px solid rgba(196,153,10,.7); }
  .watermark { position:absolute; right:24px; top:25%; opacity:.05; }
  .main { position:relative; z-index:10; flex:1; display:flex; flex-direction:column; padding:40px 48px 0; }
  .disp { font-family:'Playfair Display', Georgia, serif; }
  .mono { font-family:'DM Mono', monospace; }
  .filet { position:relative; height:1px; background:#C4990A; margin:12px auto; }
  .filet span { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:10px; line-height:1; color:#C4990A; }
  .navy { color:#1A3A6B; } .or { color:#C4990A; } .gris { color:#7A756A; }
  .row-nd { display:flex; justify-content:space-between; }
  .champ { display:flex; gap:8px; align-items:baseline; border-bottom:1px dotted rgba(122,117,106,.5); padding-bottom:6px; }
  .champ.multi { align-items:flex-start; min-height:42px; }
  .champ b { flex:0 0 auto; font-weight:700; }
  .champ span { flex:1; }
  .montant { width:80%; margin:0 auto; border:2px solid rgba(196,153,10,.7); background:rgba(253,246,227,.55); border-radius:8px; padding:16px 24px; text-align:center; }
  .valid { width:80%; margin:0 auto; display:flex; align-items:center; gap:16px; border:2px solid rgba(196,153,10,.7); border-radius:12px; padding:14px 20px; }
  .valid .ico { flex:0 0 auto; width:48px; height:48px; border-radius:50%; background:#0d2247; display:flex; align-items:center; justify-content:center; }
  .sigrow { display:flex; align-items:flex-end; justify-content:space-between; }
  .sig { text-align:center; }
  .sig .line { width:208px; border-top:1px dotted #7A756A; margin-top:48px; }
  .verif { display:flex; align-items:center; gap:16px; }
  .verif .t { font-size:11px; line-height:1.6; color:#7A756A; }
  .band { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; background:#0d2247; padding:16px 40px; font-size:11px; line-height:1.6; color:rgba(255,255,255,.9); }
  .band-l { font-weight:600; color:#C4990A; }
</style>`;

const fonts = `<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono&display=swap" rel="stylesheet">`;

/** En-tête commun : sceau + dénomination + sous-titre. */
const enTete = (sousTitre: string) => `
  <div style="display:flex; align-items:center; gap:24px;">
    ${sceau(104)}
    <div style="flex:1; text-align:center;">
      <div class="disp navy" style="font-size:26px; font-weight:700; line-height:1.15;">BARREAU DE POINTE-NOIRE</div>
      ${filet(240)}
      <div style="font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.04em;">${sousTitre}</div>
      <div class="gris" style="margin-top:4px; font-size:12px; font-style:italic;">Défendre • Conseiller • Servir la Justice</div>
    </div>
  </div>`;

/** Bloc de vérification (QR + URL). */
const verif = (qr: string, host: string, chemin: string) => `
  <div class="verif">
    <img src="${qr}" width="78" height="78" alt="QR"/>
    <div class="t">
      <div class="navy" style="font-size:12px; font-weight:600; text-transform:uppercase;">Vérification d'authenticité</div>
      Scannez ce code, ou rendez-vous sur :<br/>
      <span class="mono navy">${esc(host)}${esc(chemin)}</span>
    </div>
  </div>`;

const page = (corps: string) =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8">${fonts}${styles}</head><body><div class="doc-root">
    <div class="inner-border"></div>
    <div class="corner"><div></div></div>
    <div class="watermark" aria-hidden="true">${sceau(360)}</div>
    ${corps}
    ${bandeauContact}
  </div></body></html>`;

interface RecuLike { numero: string; montant: number; annee: number; mode?: string | null; objet?: string | null; date: Date | string; }
interface MembreLike { nom: string; num?: number; numInscription?: string | null; dateInscription?: Date | string | null; cabinet?: string | null; adresse?: string | null; }

/** Reçu de paiement — reproduction de RecuDocument. */
export function recuRicheHtml(recu: RecuLike, membre: MembreLike, qr: string, host: string): string {
  const m = Number(recu.montant) || 0;
  const corps = `
    <div class="main">
      ${enTete("Trésorerie de l'Ordre des Avocats")}
      <div style="margin-top:32px; text-align:center;">
        <div class="disp navy" style="font-size:56px; font-weight:700; line-height:1.08;">REÇU</div>
        ${filet(176)}
        <div class="or" style="font-size:20px; font-weight:500; text-transform:uppercase; letter-spacing:.12em;">Reçu de paiement</div>
      </div>
      <div class="row-nd mono navy" style="margin-top:32px; font-size:14px;">
        <span>N° ${esc(recu.numero)}</span><span>Pointe-Noire, le ${fmtDateFr(recu.date)}</span>
      </div>
      <div style="margin-top:36px;">
        <div style="text-align:center; font-size:16px; font-weight:700; text-transform:uppercase; line-height:1.375;">La Trésorière de l'Ordre des Avocats<br/>au Barreau de Pointe-Noire</div>
        <div style="margin-top:16px; text-align:center; font-size:15px; font-style:italic;">Reconnaît avoir reçu de Maître :</div>
        <div style="margin-top:24px; display:flex; flex-direction:column; gap:16px;">
          <div class="champ"><b>Nom et Prénom(s) :</b><span>Me ${esc(membre.nom)}</span></div>
          <div class="champ"><b>Au titre de :</b><span>${esc(recu.objet || `Cotisation ordinale ${recu.annee}`)}</span></div>
          <div class="champ"><b>Mode de paiement :</b><span>${esc(recu.mode || "—")}</span></div>
        </div>
        <div class="montant" style="margin-top:28px;">
          <div class="gris" style="font-size:11px; text-transform:uppercase;">Montant perçu</div>
          <div class="disp navy" style="font-size:34px; font-weight:700; line-height:1.1;">${fmtFCFA(m)}</div>
          <div class="gris" style="margin-top:2px; font-size:13px; font-style:italic;">${esc(montantEnLettresFCFA(m).replace(/^./, (c) => c.toUpperCase()))}</div>
        </div>
        <div style="margin-top:24px; text-align:center; font-size:15px;">En foi de quoi, le présent reçu lui est délivré pour servir et valoir ce que de droit.</div>
      </div>
      <div class="sigrow" style="margin-top:40px;">
        ${verif(qr, host, `/verifier/recu/${recu.numero}`)}
        ${cachet("LA", "TRÉSORERIE")}
        <div class="sig">
          <div style="font-size:13px; font-weight:600;">La Trésorière de l'Ordre</div>
          <div class="line"></div>
          <div class="gris" style="margin-top:4px; font-size:12px;">Me ONDZE BOYA</div>
        </div>
      </div>
      <div class="gris" style="margin-top:28px; text-align:center; font-size:11px; font-style:italic;">Ce reçu est strictement personnel et atteste du paiement mentionné ci-dessus.</div>
    </div>`;
  return page(corps);
}

/** Quitus de cotisation — reproduction de QuitusDocument. */
export function quitusRicheHtml(quitus: { numero: string; annee: number; dateEmission: Date | string }, membre: MembreLike, qr: string, host: string): string {
  const adresse = [membre.cabinet, membre.adresse].filter(Boolean).join(" — ");
  const inscr = membre.numInscription ?? (membre.num != null ? `${membre.num}/BPN` : "");
  const corps = `
    <div class="main">
      ${enTete("Ordre des Avocats au Barreau de Pointe-Noire")}
      <div style="margin-top:14px; text-align:center;">
        <div class="disp navy" style="font-size:56px; font-weight:700; line-height:1.08;">QUITUS</div>
        ${filet(176)}
        <div class="or" style="font-size:20px; font-weight:500; text-transform:uppercase; letter-spacing:.12em;">Certificat de non-redevance</div>
      </div>
      <div class="row-nd mono navy" style="margin-top:16px; font-size:14px;">
        <span>N° ${esc(quitus.numero)}</span><span>Pointe-Noire, le ${fmtDateFr(quitus.dateEmission)}</span>
      </div>
      <div style="margin-top:16px;">
        <div style="text-align:center; font-size:16px; font-weight:700; text-transform:uppercase; line-height:1.375;">Le Bâtonnier de l'Ordre des Avocats<br/>au Barreau de Pointe-Noire</div>
        <div style="margin-top:14px; text-align:center; font-size:15px; font-style:italic;">Atteste qu'après vérification des écritures de l'Ordre, Maître :</div>
        <div style="margin-top:16px; display:flex; flex-direction:column; gap:13px;">
          <div class="champ"><b>Nom et Prénom(s) :</b><span>Me ${esc(membre.nom)}</span></div>
          <div class="champ"><b>Inscrit(e) au Barreau sous le n° :</b><span>${esc(inscr)}</span></div>
          <div class="champ"><b>Date d'inscription :</b><span>${fmtDateFr(membre.dateInscription)}</span></div>
          <div class="champ multi"><b>Adresse professionnelle :</b><span>${esc(adresse || "—")}</span></div>
        </div>
        <div style="margin-top:14px; text-align:center; line-height:1.6;">
          <div style="font-size:17px; font-weight:700;">est à jour de toutes ses cotisations, contributions et redevances</div>
          <div style="font-size:15px;">envers l'Ordre des Avocats au Barreau de Pointe-Noire, au titre de l'exercice ${esc(quitus.annee)}.</div>
        </div>
        <div style="margin-top:12px; text-align:center; font-size:15px;">En foi de quoi, le présent quitus lui est délivré pour servir et valoir ce que de droit.</div>
      </div>
      <div class="valid" style="margin-top:16px;">
        <div class="ico">${calendrier}</div>
        <div>
          <div class="navy" style="font-size:14px; font-weight:700; text-transform:uppercase;">Validité du présent quitus</div>
          <div class="gris" style="margin-top:2px; font-size:13px;">Le présent quitus est valable pour une durée de trois (03) mois à compter de sa date de délivrance.</div>
        </div>
      </div>
      <div class="sigrow" style="margin-top:16px;">
        <div class="sig">
          <div style="font-size:13px; font-weight:600;">Le Trésorier de l'Ordre</div>
          <div class="line"></div>
          <div class="gris" style="margin-top:4px; font-size:12px;">Me ONDZE BOYA</div>
        </div>
        ${cachet("LE", "BÂTONNIER")}
        <div class="sig">
          <div style="font-size:13px; font-weight:600;">Le Bâtonnier</div>
          <div class="line"></div>
          <div class="gris" style="margin-top:4px; font-size:12px;">Me BIKINDOU Audrey Séverin</div>
        </div>
      </div>
      <div style="margin-top:14px; border-top:1px solid #E0DBD0; padding-top:12px;">
        ${verif(qr, host, `/verifier/quitus/${quitus.numero}`)}
      </div>
      <div class="gris" style="margin-top:10px; text-align:center; font-size:11px; font-style:italic;">Ce document est strictement personnel et ne peut être utilisé à d'autres fins que celles pour lesquelles il est délivré.</div>
    </div>`;
  return page(corps);
}
