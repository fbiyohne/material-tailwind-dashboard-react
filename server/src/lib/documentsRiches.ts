/**
 * Reçu de paiement et quitus de cotisation en PDF (Puppeteer), sur le socle A4 commun
 * (gabarit.ts, direction DIRECTION_PDF). Changement de mise en page seulement (M-20261016, T5) :
 * les textes des documents, la chaîne QR reçue des routes (qrDocument) et le chemin signé
 * /v/{q,r}/… sont repris à l'identique. Les aperçus à l'écran (RecuDocument, QuitusDocument)
 * restent ceux du client.
 */
import { montantEnLettresFCFA } from "./montantEnLettres.js";
import { esc, fmtFCFA, fmtDateFr } from "./documentsCommun.js";
import { identite } from "./identiteDocuments.js";
import { cachetBatonnier, cachetTresoriere } from "./cachets.js";
import { cheminVerif } from "./signature.js";
import { finQuitus } from "./business.js";
import { pageA4, entete, titre, champs, signatures, blocVerif } from "./gabarit.js";

/**
 * Habillage propre aux deux pièces (préambule, mention personnelle, coordonnées) et resserrement
 * vertical pour tenir sur une page avec les noms, cabinets et adresses les plus longs (R1) :
 * on resserre les espacements, jamais l'échelle.
 */
const CSS = `<style>
.titre-bloc { margin-top: 0; margin-bottom: 3mm; }
.preambule { font-size: 11pt; margin: 0 0 2.5mm; }
.preambule b { color: var(--encre); }
.champ { padding: 1mm 0; }
.identite { margin: 0 0 3mm; }
.encart { margin-top: 1.5mm; margin-bottom: 1.5mm; padding-top: 2.5mm; padding-bottom: 2.5mm; }
.signatures { margin-top: 3mm; margin-bottom: 1mm; }
.sig-espace { height: 19mm; }
.sig-espace img { width: 19mm; }
.verif { padding-top: 2mm; margin-top: 3mm; }
.mention-perso { font-size: var(--t-legende); font-style: italic; color: var(--gris); text-align: center; margin: 2mm 0 0; }
.coordonnees { margin: 1.5mm 0 0; padding-top: 1.5mm; border-top: .5pt solid var(--gris-m); font-size: var(--t-legende); color: var(--gris); text-align: center; }
.coordonnees span { white-space: nowrap; }
</style>`;

/** Coordonnées paramétrées (Paramètres › Identité) sur une ligne ; une valeur vide n'est pas affichée. */
const coordonnees = () => {
  const id = identite();
  const tels = id.telephones.split("/").map((t) => t.trim());
  return `<p class="coordonnees">${[id.adresse, id.courriel, id.site, ...tels].filter(Boolean).map((v) => `<span>${esc(v)}</span>`).join(" · ")}</p>`;
};

interface RecuLike { numero: string; montant: number; annee: number; mode?: string | null; objet?: string | null; date: Date | string; }
interface MembreLike { nom: string; num?: number; numInscription?: string | null; dateInscription?: Date | string | null; cabinet?: string | null; adresse?: string | null; }

/** Reçu de paiement (pièce de recette, série continue). */
export function recuRicheHtml(recu: RecuLike, membre: MembreLike, qr: string, host: string): string {
  const id = identite();
  const m = Number(recu.montant) || 0;
  return pageA4({
    titreCourt: "Reçu de paiement",
    reference: recu.numero,
    unePage: true,
    contenu: `${CSS}
${entete("Reçu n°", recu.numero, `${id.ville}, le ${fmtDateFr(recu.date)}`)}
<main>
${titre("Trésorerie de l'Ordre des Avocats", "Reçu de paiement")}
<p class="preambule"><b>La Trésorière de l'Ordre des Avocats au ${esc(id.denomination)}</b><br/>Reconnaît avoir reçu de Maître :</p>
${champs([
  ["Nom et Prénom(s)", `Me ${membre.nom}`, "nom"],
  ["Au titre de", recu.objet || `Cotisation ordinale ${recu.annee}`],
  ["Exercice couvert", String(recu.annee)],
  ["Mode de paiement", recu.mode || "—"],
])}
<div class="encart"><p class="encart-titre">Montant perçu</p><p class="montant-chiffres">${fmtFCFA(m)}</p><p class="montant-lettres">${esc(montantEnLettresFCFA(m).replace(/^./, (c) => c.toUpperCase()))}</p></div>
<div class="corps"><p>En foi de quoi, le présent reçu lui est délivré pour servir et valoir ce que de droit.</p></div>
</main>
<div class="cloture">${signatures([["La Trésorière de l'Ordre", id.tresoriere, cachetTresoriere]])}
${blocVerif(qr, host + cheminVerif("r", recu.numero))}
<p class="mention-perso">Ce reçu est strictement personnel et atteste du paiement mentionné ci-dessus.</p>
${coordonnees()}</div>`,
  });
}

/**
 * Quitus de cotisation. La date de fin est celle figée à la délivrance (Quitus.finValidite),
 * jamais la règle courante (finQuitus).
 */
export function quitusRicheHtml(quitus: { numero: string; annee: number; dateEmission: Date | string; finValidite?: Date | null }, membre: MembreLike, qr: string, host: string): string {
  const id = identite();
  const fin = finQuitus({ dateEmission: new Date(quitus.dateEmission), finValidite: quitus.finValidite });
  const adresse = [membre.cabinet, membre.adresse].filter(Boolean).join(" — ");
  const inscr = membre.numInscription ?? (membre.num != null ? `${membre.num}/BPN` : "");
  return pageA4({
    titreCourt: "Quitus",
    reference: quitus.numero,
    unePage: true,
    contenu: `${CSS}
${entete("Quitus n°", quitus.numero, `${id.ville}, le ${fmtDateFr(quitus.dateEmission)}`)}
<main>
${titre("Certificat de non-redevance", "Quitus")}
<p class="preambule"><b>Le Bâtonnier de l'Ordre des Avocats au ${esc(id.denomination)}</b><br/>Atteste qu'après vérification des écritures de l'Ordre, Maître :</p>
${champs([
  ["Nom et Prénom(s)", `Me ${membre.nom}`, "nom"],
  ["Inscrit(e) au Barreau sous le n°", inscr, "mono"],
  ["Date d'inscription", fmtDateFr(membre.dateInscription)],
  ["Adresse professionnelle", adresse || "—", "large"],
])}
<div class="corps"><p class="declaration">est à jour de toutes ses cotisations, contributions et redevances</p>
<p>envers l'Ordre des Avocats au ${esc(id.denomination)}, au titre de l'exercice ${esc(quitus.annee)}.</p>
<p>En foi de quoi, le présent quitus lui est délivré pour servir et valoir ce que de droit.</p></div>
<div class="encart"><p class="encart-titre">Validité du présent quitus</p>
<p>Valable jusqu'au <b>${fmtDateFr(fin)}</b> inclus, sauf changement de situation du titulaire, consultable à tout moment par le code de vérification.</p></div>
</main>
<div class="cloture">${signatures([["Le Trésorier de l'Ordre", id.tresoriere], ["Le Bâtonnier", id.batonnier, cachetBatonnier]])}
${blocVerif(qr, host + cheminVerif("q", quitus.numero))}
<p class="mention-perso">Ce document est strictement personnel et ne peut être utilisé à d'autres fins que celles pour lesquelles il est délivré.</p>
${coordonnees()}</div>`,
  });
}
