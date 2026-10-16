import * as T from "../../src/lib/templates.js";

/** Jeu de données fixe des 14 gabarits de la famille A (M-20261016, T4). */
const D = new Date("2026-03-14T10:00:00Z");
const membre = { nom: "NGOMA Jean-Pierre", num: 42, dateInscription: "2015-06-02T00:00:00Z" };
const reunion = { date: D, heure: "15h00", lieu: "Salle du Conseil", ordreDuJour: ["Point un", "Point deux & trois"], pv: "Première décision.\n\nSeconde <b>décision</b>.", presences: { "A. Mbemba": true, "B. Okoko": false, "C. Itoua": true } };
const discipline = { reference: "DISC-2026-007", avocatNom: "MOUKALA Paul", objet: "Manquement déontologique", dateAudience: D, decision: "Le Conseil prononce un blâme.", sanction: "Blâme", decidePar: "Conseil de discipline", dateDecision: D };
const assemblee = { type: "AGO", date: D, lieu: "Palais de justice", ordreDuJour: ["Rapport moral"], quorumPresent: 31, pv: "Débats ouverts.", decisions: ["Adoption du budget"] };
const scrutin = { titre: "Élection du Conseil 2026", type: "CONSEIL", modalite: "PRESENTIEL", nbSieges: 1, closLe: D, _count: { emargements: 60 }, candidats: [{ nom: "A. Mbemba", voix: 30 }, { nom: "B. Okoko", voix: 20 }] };
const lignesMembres = Array.from({ length: 3 }, (_, i) => ({ num: i + 1, numInscription: `INS-${i}`, nom: `Membre ${i}`, qualite: "AVOCAT", statut: "INSCRIT", cabinet: "Cabinet X", tel: "060000000", email: "m@x.cg", dateInscription: D, dateRadiation: null, dateDeces: null, rang: i + 1 }));

export const GABARITS: Record<string, () => string> = {
  attestationInscription: () => T.attestationHtml(membre, "ATT-2026-0001", D),
  attestationSortie: () => T.attestationSortieHtml(membre, "ATT-2026-0002", D, D),
  attestationNonRedevance: () => T.attestationNonRedevanceHtml(membre, "ATT-2026-0003", 2026, D),
  convocationReunion: () => T.convocationReunionHtml(reunion),
  feuillePresence: () => T.feuillePresenceHtml(reunion),
  convocationAg: () => T.convocationAgHtml(assemblee),
  convocationDiscipline: () => T.convocationDisciplineHtml(discipline),
  pvReunion: () => T.pvReunionHtml(reunion),
  pvAssemblee: () => T.pvAssembleeHtml(assemblee),
  pvScrutin: () => T.pvScrutinHtml(scrutin),
  decisionDiscipline: () => T.decisionDisciplineHtml(discipline),
  accuse: () => T.accuseReceptionHtml({ messageId: 9, sujet: "Convocation", auteurNom: "Secrétariat", destinataire: "Me NGOMA", envoyeLe: D, recuLe: D, luLe: D, empreinte: "ab12", pieceNom: "p.pdf", pieceTaille: 2048 }),
  tableauOrdre: () => T.tableauOrdreHtml([{ qualite: "AVOCAT", membres: lignesMembres }], D, { conseil: { batonnier: "Me X", bureau: [{ fonction: "Secrétaire", nom: "Y" }], membres: ["Z"] }, cabinets: [{ num: "C1", nom: "Cab", effectif: 3 }] }),
  listeAvocats: () => T.listeAvocatsHtml(lignesMembres, "tous", D),
};

/** Texte du corps seul (hors en-tête et pied), balises retirées : ancien et nouveau balisage. */
export function texteCorps(html: string): string {
  const debut = html.search(/<div class="(?:corps )?content(?: corps)?">/);
  const fin = html.search(/<div class="foot">|<!--\/corps-->/);
  return html.slice(debut, fin).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
