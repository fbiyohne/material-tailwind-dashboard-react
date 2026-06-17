/**
 * Exports de documents — chargés dynamiquement pour ne pas alourdir le bundle.
 * PDF : capture de la zone .bpn-print-zone (interim ; la V2 utilisera Puppeteer
 * côté serveur pour une qualité vectorielle). Excel : vrai fichier .xlsx.
 */

export async function exporterPdf(filename, selector = ".bpn-print-zone") {
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
  const margin = 40;
  const w = pageW - margin * 2;
  const ratio = w / canvas.width; // px du canvas → pt sur la page
  const pageHpx = (pageH - margin * 2) / ratio; // hauteur d'une page A4, en px du canvas

  // Une seule page si le contenu tient ; sinon découpe en tranches A4 pour ne
  // jamais déborder (les états/listes longs sont paginés au lieu d'être rognés).
  if (canvas.height <= pageHpx + 1) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, w, canvas.height * ratio);
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
    await exporterPdf(filename, selector);
  }
}

export async function exporterExcel(filename, lignes, sheetName = "Feuille1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
