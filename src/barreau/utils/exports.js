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
  const img = canvas.toDataURL("image/png");
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 40;
  const w = pageW - margin * 2;
  const h = (canvas.height / canvas.width) * w;
  pdf.addImage(img, "PNG", margin, margin, w, h);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function exporterExcel(filename, lignes, sheetName = "Feuille1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
