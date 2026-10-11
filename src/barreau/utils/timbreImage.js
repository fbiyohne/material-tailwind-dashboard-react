import QRCode from "qrcode";
import { formatFCFA, formatDate } from "./format";

/** Largeur minimale (px) de l'image copiée ou téléchargée, QR inclus. */
export const LARGEUR_MIN = 1200;
/** Clause CL-TIMBRE (avis juridique) : le timbre ne vaut que pour l'affaire imprimée. */
export const CLAUSE_TIMBRE = "Valable pour cette seule affaire. Toute reproduction pour un autre acte est sans valeur.";
export const MENTION_PROTOTYPE = "PROTOTYPE – sans valeur, aucun paiement réel";

/** Échelle html2canvas qui garantit au moins LARGEUR_MIN pixels de large. */
export const echelleCapture = (largeur) => Math.ceil(LARGEUR_MIN / Math.max(1, largeur));

const echapper = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Capture le nœud en PNG (≥ 1200 px de large). */
export async function timbrePng(noeud) {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(noeud, { scale: echelleCapture(noeud.offsetWidth || 360), backgroundColor: null, useCORS: true });
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Image indisponible.");
  return blob;
}

export function telechargerBlob(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copie le timbre (PNG) dans le presse-papiers. Hors contexte sécurisé ou sans
 * ClipboardItem, repli sur le téléchargement. Renvoie { copie, message }.
 * On passe une promesse à ClipboardItem (exigé par Safari : le geste utilisateur
 * ne doit pas être perdu pendant la capture).
 */
export async function copierTimbre(noeud, nom, { png = timbrePng, telecharger = telechargerBlob } = {}) {
  const peut = typeof window !== "undefined" && window.isSecureContext && window.ClipboardItem && navigator.clipboard?.write;
  if (peut) {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ "image/png": png(noeud) })]);
      return { copie: true, message: "Timbre copié — collez-le dans votre document (Ctrl+V)." };
    } catch { /* refus ou erreur : repli ci-dessous */ }
  }
  telecharger(await png(noeud), nom);
  return { copie: false, message: "Copie impossible sur ce navigateur ou hors connexion sécurisée (HTTPS) — le PNG a été téléchargé, insérez-le dans votre document." };
}

/** SVG vectoriel (sans foreignObject, lisible par Word et LibreOffice) du timbre. */
export async function timbreSvg(timbre, url, { prototype = false } = {}) {
  const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1A3A6B", light: "#ffffff" } });
  const vb = qr.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 33 33";
  const interieur = qr.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const ligne = (y, txt, { taille = 14, poids = 400, couleur = "#1A2A3A", famille = "Arial, Helvetica, sans-serif" } = {}) =>
    `<text x="180" y="${y}" text-anchor="middle" font-family="${famille}" font-size="${taille}" font-weight="${poids}" fill="${couleur}">${echapper(txt)}</text>`;
  const serif = "Georgia, 'Times New Roman', serif";
  const nom = timbre.membre?.nom ?? timbre.membreNom;
  const lignes = [
    ligne(34, "TIMBRE DE PLAIDOIRIE", { taille: 11, poids: 700, couleur: "#8A6D08" }),
    ligne(80, `N° ${timbre.numero}`, { taille: 34, poids: 700, couleur: "#1A3A6B", famille: serif }),
    ligne(112, `Affaire : ${timbre.affaire ?? ""}`, { taille: 14, poids: 600 }),
    timbre.reference ? ligne(132, `RG : ${timbre.reference}`) : "",
    timbre.juridiction ? ligne(152, timbre.juridiction) : "",
    nom ? ligne(180, `Me ${nom}`, { taille: 17, poids: 700, couleur: "#1A3A6B", famille: serif }) : "",
    ligne(204, `Droit de plaidoirie : ${formatFCFA(timbre.montant)}`, { taille: 13, poids: 700, couleur: "#1A3A6B" }),
    ligne(224, `Émis le ${formatDate(timbre.createdAt)}`, { taille: 11, couleur: "#4A5568" }),
  ].join("");
  const bas = [
    ligne(436, "Authenticité vérifiable en scannant ce code.", { taille: 10, couleur: "#4A5568" }),
    ligne(452, CLAUSE_TIMBRE, { taille: 8.5, couleur: "#4A5568" }),
    prototype ? ligne(474, MENTION_PROTOTYPE, { taille: 10, poids: 700, couleur: "#B3261E" }) : "",
  ].join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${prototype ? 488 : 468}" viewBox="0 0 360 ${prototype ? 488 : 468}">`
    + `<rect width="360" height="${prototype ? 488 : 468}" fill="#0E2144"/><rect x="4" y="4" width="352" height="${prototype ? 480 : 460}" fill="#FBF9F0" stroke="#C4990A" stroke-width="1.5"/>`
    + lignes
    + `<svg x="90" y="240" width="180" height="180" viewBox="${echapper(vb)}">${interieur}</svg>`
    + bas + `</svg>`;
}

export const telechargerSvg = (svg, nom) => telechargerBlob(new Blob([svg], { type: "image/svg+xml" }), nom);
