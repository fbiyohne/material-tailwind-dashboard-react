/**
 * Exports de documents — chargés dynamiquement pour ne pas alourdir le bundle.
 * PDF : capture de la zone .bpn-print-zone (interim ; la V2 utilisera Puppeteer
 * côté serveur pour une qualité vectorielle). Excel : vrai fichier .xlsx.
 */

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
  const img = canvas.toDataURL("image/png");

  // Mode « document » : une seule page A4, le document mis à l'échelle pour tenir
  // entièrement (jamais rogné ni débordé) et centré. Marge minime car les
  // documents portent déjà leur propre cadre. Idéal pour reçus/quitus/attestations.
  if (page) {
    const m = 14;
    const echelle = Math.min((pageW - 2 * m) / canvas.width, (pageH - 2 * m) / canvas.height);
    const w = canvas.width * echelle;
    const h = canvas.height * echelle;
    pdf.addImage(img, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
    return;
  }

  // Mode « flux » (états/listes) : largeur fixée, contenu plus haut qu'une page
  // découpé en tranches A4 successives pour ne jamais déborder ni rogner.
  const margin = 40;
  const w = pageW - margin * 2;
  const ratio = w / canvas.width;
  const pageHpx = (pageH - margin * 2) / ratio;
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
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
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

export async function exporterExcel(filename, lignes, sheetName = "Feuille1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
