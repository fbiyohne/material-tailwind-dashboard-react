/**
 * Export texte délimité léger, sans dépendance : CSV (séparateur « ; »
 * compatible Excel FR) et TXT (tabulations, lisible dans Bloc-notes, collable
 * dans Word/Excel). `colonnes` : [{ label, valeur: (ligne) => any }].
 * Échappement RFC 4180 : une valeur contenant le séparateur, un guillemet ou
 * un retour à la ligne est entourée de guillemets (guillemets doublés).
 */
function echapper(v, sep) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Injection de formule (CSV/TXT ouverts dans Excel/LibreOffice) : une valeur
  // commençant par = @ tabulation ou CR, ou par + / - non suivi d'un simple
  // nombre/téléphone (« +242 06… », « -5000 »), est préfixée d'une apostrophe.
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().]*$/.test(s))) s = `'${s}`;
  if (s.includes(sep) || /["\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function versDelimite(colonnes, lignes, sep) {
  const entete = colonnes.map((c) => echapper(c.label, sep)).join(sep);
  const corps = lignes.map((l) => colonnes.map((c) => echapper(c.valeur(l), sep)).join(sep));
  return [entete, ...corps].join("\r\n");
}

export const versCsv = (colonnes, lignes) => versDelimite(colonnes, lignes, ";");

/** Déclenche le téléchargement d'un contenu texte sous le nom donné. */
export function telechargerTexte(nomFichier, contenu, mime) {
  const url = URL.createObjectURL(new Blob([contenu], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const avecExtension = (nom, ext) => (nom.endsWith(ext) ? nom : `${nom}${ext}`);

/** Téléchargement CSV (BOM UTF-8 pour qu'Excel reconnaisse l'encodage). */
export function telechargerCsv(nomFichier, colonnes, lignes) {
  telechargerTexte(avecExtension(nomFichier, ".csv"), "\uFEFF" + versCsv(colonnes, lignes), "text/csv;charset=utf-8;");
}

/** Téléchargement TXT à tabulations, UTF-8 sans BOM (ré-importable tel quel). */
export function telechargerTxt(nomFichier, colonnes, lignes) {
  telechargerTexte(avecExtension(nomFichier, ".txt"), versDelimite(colonnes, lignes, "\t"), "text/plain;charset=utf-8;");
}
