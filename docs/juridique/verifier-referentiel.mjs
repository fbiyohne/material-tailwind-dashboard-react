// Contrôle du référentiel juridique (T2) : node docs/juridique/verifier-referentiel.mjs
// Sort en code 1 à la première série d'écarts. Aucune dépendance.
import { readFileSync } from "node:fs";

const lire = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const regles = lire("./regles-reference.md");
const clauses = lire("./clauses-congres.md");
const cycle = lire("./cycle-de-vie-avocats.md");
const points = lire("../audit/POINTS-OUVERTS.md");
const erreurs = [];
const verifier = (ok, msg) => ok || erreurs.push(msg);

// 1. Chaque règle : valeur, source, statut cohérent avec la source.
const lignes = regles.split("\n").filter((l) => /^\| R-\d{2} /.test(l));
verifier(lignes.length >= 30, `regles-reference : ${lignes.length} règles (30 attendues au moins)`);
for (const l of lignes) {
  const c = l.split("|").map((s) => s.trim());
  const [id, , valeur, , source, statut] = c.slice(1);
  verifier(valeur, `${id} : valeur vide`);
  verifier(statut === "légal" || statut === "provisoire", `${id} : statut « ${statut} » invalide`);
  if (statut === "légal") {
    verifier(/loi n° (026-92|29-2019), art\. \d+/.test(source), `${id} : règle légale sans article de loi`);
    verifier(!/règlement intérieur|aucun texte/i.test(source), `${id} : règle légale sourcée hors loi`);
  }
  if (statut === "provisoire")
    verifier(/règlement intérieur — à confirmer|aucun texte — à confirmer/.test(source), `${id} : provisoire sans « à confirmer »`);
}

// 2. Valeurs écartées par l'avis juridique (loi 026-92, art. 15, 32, 36).
const nouveaux = { regles, clauses, points };
for (const [nom, txt] of Object.entries({ ...nouveaux, cycle })) {
  for (const interdit of [/bl[âa]me/i, /36 mois/, /avocats? (inscrits? )?d'un autre barreau/i, /inscrits? dans un autre barreau/i])
    verifier(!interdit.test(txt), `${nom} : occurrence interdite ${interdit}`);
}
for (const [nom, txt] of Object.entries(nouveaux)) verifier(!/\b10 ans\b/.test(txt), `${nom} : « 10 ans » présent`);
verifier(!cycle.split("\n").some((l) => /10 ans/.test(l) && /bâtonn/i.test(l)), "cycle : « 10 ans » associé au bâtonnat");

// 3. Clauses : 14, non-équivalence au recommandé, aucun terme interdit hors de la liste des interdits.
const nbClauses = (clauses.match(/^### C-\d{2} /gm) || []).length;
verifier(nbClauses === 14, `clauses-congres : ${nbClauses} clauses (14 attendues)`);
verifier(clauses.includes("Il ne vaut ni lettre recommandée ni notification au sens des articles 39 et 42 de la loi n° 026-92 du 20 août 1992. Valeur probatoire à confirmer."), "clauses-congres : pied d'accusé incomplet");
const horsListe = clauses.replace(/<!-- termes-interdits:debut -->[\s\S]*?<!-- termes-interdits:fin -->/, "");
for (const t of [/certifi[ée]/i, /horodatage qualifi/i, /signature électronique/i, /recommandé électronique/i])
  verifier(!t.test(horsListe), `clauses-congres : terme interdit ${t} hors de la liste des interdits`);
for (const s of ["Messagerie", "Dossier disciplinaire"])
  verifier(new RegExp(String.raw`### 2\.2\.\d+ .*${s}`).test(cycle), `cycle-de-vie : section 2.2 « ${s} » absente`);

// 4. Points ouverts : thèmes minimaux, valeur provisoire et interlocutrice pour chacun.
const sections = points.split(/^### /m).slice(1);
verifier(sections.length >= 15, `POINTS-OUVERTS : ${sections.length} points (15 attendus au moins)`);
for (const s of sections) {
  const titre = s.split("\n")[0];
  verifier(/\*\*Valeur provisoire retenue\*\* :/.test(s), `PO « ${titre} » : valeur provisoire absente`);
  verifier(/Me Kalina MENGA/.test(s), `PO « ${titre} » : interlocutrice absente`);
}
for (const theme of ["Durée du stage", "Sursis", "Relances", "Congé", "Rang", "Assurance", "radiation pendant les recours", "Électorat", "Éligibilité au Conseil", "Rôle du Secrétaire général", "Timbre de plaidoirie", "Confidentialité des correspondances", "Valeur probatoire", "Conservation des messages", "Kinshasa"])
  verifier(sections.some((s) => s.split("\n")[0].includes(theme)), `POINTS-OUVERTS : thème « ${theme} » absent`);

if (erreurs.length) { console.error(erreurs.join("\n")); process.exit(1); }
console.log(`OK — ${lignes.length} règles, ${nbClauses} clauses, ${sections.length} points ouverts.`);
