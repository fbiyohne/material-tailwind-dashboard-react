// Assainit le HTML produit par l'éditeur riche (contentEditable) avant sauvegarde
// et avant tout rendu (dangerouslySetInnerHTML). Allowlist stricte de balises,
// suppression de TOUS les attributs (on*, style, href, src…), retrait total des
// <script>/<style> et des commentaires. Suffisant car on n'autorise aucune balise
// ni attribut porteur de script.
const BALISES_OK = new Set([
  "P", "BR", "B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "H3", "H4", "DIV", "SPAN",
]);

export function assainirHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(String(html), "text/html");
  const purger = (parent) => {
    [...parent.childNodes].forEach((n) => {
      if (n.nodeType === 8) { n.remove(); return; } // commentaire
      if (n.nodeType !== 1) return; // texte : conservé tel quel (échappé par le DOM)
      if (n.tagName === "SCRIPT" || n.tagName === "STYLE") { n.remove(); return; }
      [...n.attributes].forEach((a) => n.removeAttribute(a.name));
      purger(n);
      if (!BALISES_OK.has(n.tagName)) n.replaceWith(...n.childNodes); // déballe l'inconnu
    });
  };
  purger(doc.body);
  return doc.body.innerHTML.trim();
}

/** Vrai si la chaîne contient du balisage (distingue le HTML riche du texte brut). */
export const estHtml = (s) => !!s && /<[a-z][\s\S]*>/i.test(s);
