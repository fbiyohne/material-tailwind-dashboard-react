/**
 * Export CSV léger (séparateur « ; » compatible Excel FR), sans dépendance.
 * `colonnes` : [{ label, valeur: (ligne) => any }]. Échappe selon RFC 4180.
 */
function echapper(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function versCsv(colonnes, lignes) {
  const entete = colonnes.map((c) => echapper(c.label)).join(";");
  const corps = lignes.map((l) => colonnes.map((c) => echapper(c.valeur(l))).join(";"));
  return [entete, ...corps].join("\r\n");
}

/** Déclenche le téléchargement d'un CSV (BOM UTF-8 pour Excel). */
export function telechargerCsv(nomFichier, colonnes, lignes) {
  const csv = "﻿" + versCsv(colonnes, lignes);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier.endsWith(".csv") ? nomFichier : `${nomFichier}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
