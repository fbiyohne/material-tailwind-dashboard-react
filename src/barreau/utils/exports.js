/**
 * Exports de documents — chargés dynamiquement pour ne pas alourdir le bundle.
 * PDF : capture de la zone .bpn-print-zone (interim ; la V2 utilisera Puppeteer
 * côté serveur pour une qualité vectorielle). Excel : vrai fichier .xlsx.
 */

import { identite } from "../data/config";

// C-PDF-LISTE (avis juridique) : pied des exports non publics. Sélecteurs des états concernés.
export const CLAUSE_LISTE =
  "Document à diffusion restreinte, réservé aux organes de l'Ordre. Contient des données à caractère personnel protégées par la loi n° 29-2019 du 10 octobre 2019. Toute rediffusion est interdite.";
const ETATS_RESTREINTS = ["#zone-impression-avocats", "#etat-cotisations"];

/**
 * Écrit sur chaque page : pied « dénomination · Page i/n » (C-PDF-PIED), clause
 * C-PDF-LISTE si `restreint`, et en-tête court à partir de la page 2.
 */
export function ajouterPieds(pdf, { denomination, restreint = false, marge = 40 }) {
  const n = pdf.getNumberOfPages();
  const L = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  pdf.setFont("helvetica", "normal");
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setTextColor(110);
    pdf.setFontSize(8);
    if (i > 1) pdf.text(denomination, marge, 24);
    if (restreint) {
      pdf.setFontSize(6.5);
      pdf.text(pdf.splitTextToSize(CLAUSE_LISTE, L - 2 * marge), marge, H - 38);
    }
    pdf.setFontSize(8);
    pdf.text(denomination, marge, H - 20);
    pdf.text(`Page ${i}/${n}`, L - marge, H - 20, { align: "right" });
  }
}

export async function exporterPdf(filename, selector = ".bpn-print-zone", { page = false } = {}) {
  const el = document.querySelector(selector);
  if (!el) return;
  const [{ default: html2canvas }, jspdfMod] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const JsPDF = jspdfMod.jsPDF || jspdfMod.default;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const restreint = ETATS_RESTREINTS.includes(selector);
  const denomination = identite().denomination || "";
  // Marge basse : réserve la place du pied (et de la clause C-PDF-LISTE).
  const bas = page ? 34 : restreint ? 72 : 56;
  const fin = () => {
    ajouterPieds(pdf, { denomination, restreint });
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
  };

  // Mode « document » : une seule page A4, le document mis à l'échelle pour tenir
  // entièrement (jamais rogné ni débordé) et centré. Marge minime car les
  // documents portent déjà leur propre cadre. Idéal pour reçus/quitus/attestations.
  if (page) {
    // JPEG haute qualité : un PNG 2× d'une A4 pèse >10 Mo ; le JPEG ramène à ~1 Mo
    // sans perte visible sur un document (fond blanc + aplats).
    const img = canvas.toDataURL("image/jpeg", 0.95);
    const m = 14;
    const dispo = pageH - m - bas;
    const echelle = Math.min((pageW - 2 * m) / canvas.width, dispo / canvas.height);
    const w = canvas.width * echelle;
    const h = canvas.height * echelle;
    pdf.addImage(img, "JPEG", (pageW - w) / 2, m + (dispo - h) / 2, w, h);
    fin();
    return;
  }

  // Mode « flux » (états/listes) : largeur fixée, contenu plus haut qu'une page
  // découpé en tranches A4 successives pour ne jamais déborder ni rogner.
  const img = canvas.toDataURL("image/png");
  const margin = 40;
  const w = pageW - margin * 2;
  const ratio = w / canvas.width;
  const pageHpx = (pageH - margin - bas) / ratio;
  if (canvas.height <= pageHpx + 1) {
    pdf.addImage(img, "PNG", margin, margin, w, canvas.height * ratio);
  } else {
    for (let offset = 0, premier = true; offset < canvas.height; premier = false) {
      const sliceHpx = Math.min(pageHpx, canvas.height - offset);
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = Math.ceil(sliceHpx);
      const ctx = part.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, part.width, part.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
      if (!premier) pdf.addPage();
      pdf.addImage(part.toDataURL("image/png"), "PNG", margin, margin, w, sliceHpx * ratio);
      offset += sliceHpx;
    }
  }
  fin();
}

/**
 * Télécharge un document officiel : PDF vectoriel rendu par le serveur en
 * priorité ; si le serveur ne peut pas le produire (p. ex. navigateur
 * d'impression absent), repli automatique sur un rendu client de l'aperçu
 * visible (zone `selector`), paginé en A4. Le document reste donc obtenable
 * même sans Chromium côté serveur.
 */
export async function telechargerDocumentPdf(rendreServeur, filename, selector = ".bpn-print-zone") {
  try {
    await rendreServeur();
  } catch (e) {
    if (!document.querySelector(selector)) throw e; // pas d'aperçu local : on remonte l'erreur serveur
    await exporterPdf(filename, selector, { page: true });
  }
}

/**
 * Exporte un élément (ex. la vignette du timbre) en image PNG téléchargeable —
 * pratique pour coller le timbre dans un acte rédigé au cabinet.
 */
export async function exporterPng(selector, filename) {
  const el = document.querySelector(selector);
  if (!el) return;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 3, backgroundColor: null, useCORS: true });
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
}

/**
 * Copie un élément (ex. la vignette) dans le presse-papier en tant qu'image PNG,
 * pour le coller directement dans un document Word/PDF. Renvoie true si la copie
 * a réussi ; false si le navigateur ne le permet pas (l'appelant proposera alors
 * le téléchargement).
 */
export async function copierPng(selector) {
  const el = document.querySelector(selector);
  if (!el || !navigator.clipboard || !window.ClipboardItem) return false;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(el, { scale: 3, backgroundColor: null, useCORS: true });
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export async function exporterExcel(filename, lignes, sheetName = "Feuille1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
