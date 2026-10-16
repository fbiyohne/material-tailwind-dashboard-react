/**
 * Aperçu de la direction de gabarit « Officielle » (proposition, NON appliquée aux routes).
 * Reprend le papier à en-tête réel du Barreau (modèles Word officiels) : logo rond centré entre
 * deux filets bleus, pied à coordonnées, bandes jaune et bleue. Produit 3 PDF A4 + leurs PNG.
 * Usage (depuis server/) : npx tsx scripts/apercu-officiel.ts <dossier-assets> <dossier-sortie>
 *   dossier-assets : logo-barreau.png, cachet-batonnier.png, cachet-tresoriere.png
 */
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { htmlVersPdf } from "../src/lib/pdf.js";

const [assets, sortie] = process.argv.slice(2);
if (!assets || !sortie) throw new Error("usage : apercu-officiel.ts <dossier-assets> <dossier-sortie>");
const img = (f: string) => `data:image/png;base64,${fs.readFileSync(path.join(assets, f)).toString("base64")}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Identité réelle relevée sur le papier à en-tête officiel (à terme : Paramètres > Barreau et identité).
const ID = {
  tel: "06.857.74.74", mail: "contact@barreaudepointenoire.cg", site: "barreaudepointenoire.cg",
  adresse1: "245, Boulevard Charles De Gaulle", adresse2: "Tour Mayombe, Entrée Mezzanine",
};
const BLEU = "#2E67B1", BLEU_NUIT = "#163A6B", JAUNE = "#FDD13B", ENCRE = "#1E2430", GRIS = "#5A6170";

// Pictogrammes dessinés (trait unique 1.6, même famille) : téléphone, globe, repère.
const ico = {
  tel: `<svg viewBox="0 0 24 24"><path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>`,
  web: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>`,
  lieu: `<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
};

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; }
body { font-family: "Source Serif 4", Georgia, serif; color: ${ENCRE}; font-size: 10.8pt; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: lining-nums; }
.page { position: relative; width: 210mm; height: 297mm; padding: 12mm 22mm 0; overflow: hidden; }
/* En-tête : logo centré entre deux filets, comme le papier officiel */
.entete { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 6mm; }
.entete i { height: 0; border-top: 0.6pt solid ${BLEU}; }
.entete img { width: 29mm; height: auto; display: block; }
.emetteur { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 7mm;
  font-family: Montserrat, sans-serif; font-size: 8.4pt; color: ${GRIS}; letter-spacing: 0.02em; }
.emetteur b { display: block; font-weight: 600; color: ${BLEU_NUIT}; font-size: 8.8pt; letter-spacing: 0.08em; text-transform: uppercase; }
.emetteur .droite { text-align: right; }
.emetteur .ref { font-variant-numeric: tabular-nums; color: ${ENCRE}; }
/* Titre de l'acte */
h1 { margin: 11mm 0 0; text-align: center; font-family: Montserrat, sans-serif; font-weight: 700; font-size: 19pt;
  letter-spacing: 0.16em; text-transform: uppercase; color: ${BLEU_NUIT}; }
.filet { width: 16mm; height: 1.4pt; background: ${JAUNE}; margin: 3.5mm auto 0; }
.sous-titre { text-align: center; font-style: italic; color: ${GRIS}; margin: 3mm 0 0; font-size: 10.5pt; }
/* Corps de l'acte */
.corps { margin-top: 9mm; text-align: justify; hyphens: auto; }
.corps p { margin: 0 0 4.2mm; }
.nom { font-weight: 600; letter-spacing: 0.01em; }
.montant { margin: 7mm 0 7mm; padding: 5mm 0; border-top: 0.6pt solid #C9D3E3; border-bottom: 0.6pt solid #C9D3E3;
  display: grid; grid-template-columns: 1fr auto; align-items: baseline; }
.montant .lib { font-family: Montserrat, sans-serif; font-size: 8.6pt; letter-spacing: 0.08em; text-transform: uppercase; color: ${GRIS}; }
.montant .val { font-family: Montserrat, sans-serif; font-weight: 700; font-size: 17pt; color: ${BLEU_NUIT}; font-variant-numeric: tabular-nums; }
.montant .lettres { grid-column: 1 / -1; font-style: italic; color: ${GRIS}; font-size: 10pt; margin-top: 1mm; }
dl.faits { display: grid; grid-template-columns: 38mm 1fr; column-gap: 6mm; row-gap: 1.6mm; margin: 0 0 6mm; }
dl.faits dt { font-family: Montserrat, sans-serif; font-size: 8.4pt; color: ${GRIS}; padding-top: 0.6mm; }
dl.faits dd { margin: 0; }
/* Fait à… et signature */
.fait { margin-top: 6mm; text-align: right; }
.signature { margin: 2mm 0 0 auto; width: 76mm; text-align: center; }
.signature .tampon { position: relative; height: 27mm; }
.signature .role { font-family: Montserrat, sans-serif; font-weight: 600; font-size: 8.8pt; letter-spacing: 0.1em; text-transform: uppercase; color: ${BLEU_NUIT}; }
.signature img { width: 25mm; position: absolute; left: 50%; top: 1mm; transform: translateX(-50%) rotate(-7deg); opacity: 0.9; }
.signature .nom-sig { padding-top: 1.5mm; border-top: 0.5pt solid #C9D3E3; line-height: 1.3; }
/* Vérification + pied officiel */
.verif { position: absolute; left: 22mm; right: 22mm; bottom: 35mm; display: grid; grid-template-columns: 21mm 1fr; gap: 5mm; align-items: center;
  font-family: Montserrat, sans-serif; font-size: 7.6pt; line-height: 1.45; color: ${GRIS}; }
.verif img { width: 21mm; height: 21mm; display: block; }
.verif b { color: ${BLEU_NUIT}; font-weight: 600; }
.verif .code { color: ${ENCRE}; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.pied { position: absolute; left: 0; right: 0; bottom: 0; height: 30mm; }
.pied .filet-pied { margin: 0 15mm; border-top: 0.8pt solid ${BLEU}; }
.pied .coord { display: grid; grid-template-columns: auto auto auto; justify-content: space-between; margin: 3.2mm 15mm 0;
  font-family: Montserrat, sans-serif; font-size: 8pt; line-height: 1.35; color: ${ENCRE}; }
.pied .coord div { display: flex; gap: 2.2mm; align-items: flex-start; }
.pied svg { width: 3.6mm; height: 3.6mm; flex: none; margin-top: 0.3mm; fill: none; stroke: ${ENCRE}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pied .page-n { position: absolute; right: 15mm; bottom: 14mm; font-family: Montserrat, sans-serif; font-size: 7pt; color: ${GRIS}; }
.bande-jaune { position: absolute; left: 0; bottom: 6mm; width: 46%; height: 4.2mm; background: ${JAUNE}; clip-path: polygon(0 0, 96% 0, 100% 100%, 0 100%); }
.bande-bleue { position: absolute; left: 0; right: 0; bottom: 0; height: 6mm; background: ${BLEU}; }
`;

const pied = (ref: string) => `
<div class="pied"><div class="filet-pied"></div>
  <div class="coord">
    <div>${ico.tel}<span>${ID.tel}</span></div>
    <div>${ico.web}<span>${ID.mail}<br>${ID.site}</span></div>
    <div>${ico.lieu}<span>${ID.adresse1}<br>${ID.adresse2}</span></div>
  </div>
  <div class="page-n">Réf. ${esc(ref)} · Page 1/1</div>
  <div class="bande-jaune"></div><div class="bande-bleue"></div>
</div>`;

async function verif(code: string, chemin: string): Promise<string> {
  const url = `https://${ID.site}${chemin}`;
  const qr = await QRCode.toDataURL(url, { margin: 0, width: 300, color: { dark: BLEU_NUIT } });
  return `<div class="verif"><img src="${qr}" alt="QR de vérification"><div><b>Vérification d'authenticité.</b> Scannez ce code avec l'appareil photo d'un téléphone, ou rendez-vous sur<br><span class="code">${ID.site}${chemin}</span><br>La page confirme que l'acte a été émis par l'Ordre et indique son statut actuel.</div></div>`;
}

const page = (o: { emetteur: string; ref: string; date: string; titre: string; sousTitre?: string; corps: string; role: string; cachet: string; signataire: string; verif?: string }) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><div class="page">
  <div class="entete"><i></i><img src="${img("logo-barreau.png")}" alt="Ordre des avocats du Congo, Barreau de Pointe-Noire"><i></i></div>
  <div class="emetteur"><div><b>${o.emetteur}</b>Ordre des Avocats au Barreau de Pointe-Noire</div>
    <div class="droite">N° <span class="ref">${esc(o.ref)}</span><br>Pointe-Noire, le ${o.date}</div></div>
  <h1>${o.titre}</h1><div class="filet"></div>${o.sousTitre ? `<p class="sous-titre">${o.sousTitre}</p>` : ""}
  <div class="corps">${o.corps}</div>
  <p class="fait">Fait à Pointe-Noire, le ${o.date}.</p>
  <div class="signature"><div class="role">${o.role}</div><div class="tampon"><img src="${img(o.cachet)}" alt="Cachet"></div><div class="nom-sig">${o.signataire}</div></div>
  ${o.verif ?? ""}
  ${pied(o.ref)}
</div></body></html>`;

const avocat = { nom: "MBOUNGOU-NDZOUNGOU Marie-Chantal Hortense Aurélienne", num: "142/BPN", depuis: "2 mars 2015",
  adresse: "Société Civile Professionnelle d'Avocats Mboungou, Ndzoungou et Associés, immeuble Les Palmiers, 3e étage, porte 12, avenue de l'Indépendance, quartier Plateau, Pointe-Noire" };

const CODES = ["Q-2026-089.7BRJTNS3HM", "R-2026-001.S63VA130G8", "AT-2026-0001.K4M2Q8ZP1D"];
const V = await Promise.all([[CODES[0], "/v/q/"], [CODES[1], "/v/r/"], [CODES[2], "/v/a/"]].map(([c, p]) => verif(c, p + c)));
const docs: Record<string, string> = {
  quitus: page({
    emetteur: "Le Bâtonnier", ref: "Q-2026-089", date: "20 mai 2026", titre: "Quitus", sousTitre: "Certificat de non-redevance",
    corps: `<p>Le Bâtonnier de l'Ordre des Avocats au Barreau de Pointe-Noire, après vérification des écritures de l'Ordre, certifie que</p>
      <p style="text-align:center;margin:6mm 0">Maître <span class="nom">${avocat.nom}</span></p>
      <dl class="faits"><dt>Inscription</dt><dd>au Tableau sous le n° ${avocat.num}, depuis le ${avocat.depuis}</dd>
        <dt>Domicile professionnel</dt><dd>${avocat.adresse}</dd></dl>
      <p>est à jour de toutes ses cotisations, contributions et redevances envers l'Ordre au titre de l'exercice 2026.</p>
      <p>Le présent quitus est valable jusqu'au <b>20 août 2026</b> inclus, sauf changement de situation de son titulaire. Il est délivré pour servir et valoir ce que de droit.</p>`,
    role: "Le Bâtonnier", cachet: "cachet-batonnier.png", signataire: "Me BIKINDOU Audrey Séverin", verif: V[0],
  }),
  recu: page({
    emetteur: "La Trésorière", ref: "R-2026-001", date: "9 octobre 2026", titre: "Reçu de paiement",
    corps: `<p>La Trésorière de l'Ordre des Avocats au Barreau de Pointe-Noire reconnaît avoir reçu de Maître <span class="nom">${avocat.nom}</span>, inscrit(e) au Tableau sous le n° ${avocat.num}, la somme ci-dessous.</p>
      <div class="montant"><span class="lib">Montant perçu</span><span class="val">150 000 FCFA</span><span class="lettres">Cent cinquante mille francs CFA</span></div>
      <dl class="faits"><dt>Objet</dt><dd>Cotisation ordinale, exercice 2026</dd><dt>Mode de règlement</dt><dd>Espèces</dd></dl>
      <p>Le présent reçu est délivré pour servir et valoir ce que de droit.</p>`,
    role: "La Trésorière", cachet: "cachet-tresoriere.png", signataire: "Me ONDZE BOYA Armelle Laure Carine", verif: V[1],
  }),
  "attestation-inscription": page({
    emetteur: "Le Bâtonnier", ref: "AT-2026-0001", date: "11 octobre 2026", titre: "Attestation d'inscription",
    corps: `<p>Le Bâtonnier de l'Ordre des Avocats au Barreau de Pointe-Noire atteste que</p>
      <p style="text-align:center;margin:6mm 0">Maître <span class="nom">${avocat.nom}</span></p>
      <p>est inscrit(e) au Tableau de l'Ordre des Avocats du Barreau de Pointe-Noire sous le numéro ${avocat.num}, depuis le ${avocat.depuis}, et exerce à ce jour la profession d'avocat sans interruption.</p>
      <p>La présente attestation est délivrée à l'intéressé(e), sur sa demande, pour servir et valoir ce que de droit.</p>`,
    role: "Le Bâtonnier", cachet: "cachet-batonnier.png", signataire: "Me BIKINDOU Audrey Séverin", verif: V[2],
  }),
};

fs.mkdirSync(sortie, { recursive: true });
for (const [nom, html] of Object.entries(docs)) {
  fs.writeFileSync(path.join(sortie, `${nom}.html`), html);
  fs.writeFileSync(path.join(sortie, `${nom}.pdf`), await htmlVersPdf(html));
  console.log("écrit", nom);
}
process.exit(0);
