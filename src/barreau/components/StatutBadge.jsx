import PropTypes from "prop-types";
import { Badge } from "./Badge";
import { STATUT_MEMBRE_META } from "../data/derivations";

/**
 * Explication courte de chaque statut (infobulle + lecteur d'écran). Elle lève la
 * confusion omission / radiation relevée en réunion (R10) : l'omission est une
 * mesure administrative temporaire, la radiation une sanction disciplinaire.
 * Tenue à part de STATUT_MEMBRE_META, dont les libellés sont surchargeables.
 */
export const STATUT_AIDE = {
  inscrit: "Inscrit au tableau, en exercice.",
  suspendu: "Interdiction temporaire d'exercer ; reste inscrit au tableau.",
  radie: "Sanction disciplinaire : retiré du tableau, sous réserve des voies de recours.",
  omis: "Mesure administrative temporaire : n'exerce plus jusqu'à sa réinscription.",
  honoraire: "Honorariat conféré par le Conseil de l'Ordre national.",
  stagiaire: "Avocat stagiaire, inscrit sur la liste du stage.",
  decede: "Décès enregistré : hors tableau.",
  demissionnaire: "Démission sur demande écrite : sortie définitive du tableau.",
  retraite: "Départ à la retraite : sortie définitive du tableau.",
  cessation: "Cessation d'activité sur demande écrite : sortie définitive du tableau.",
};

// L'omission (temporaire) partage le ton or de l'honorariat : un contour en
// pointillés la distingue et rappelle son caractère provisoire.
const FORME = { omis: "outline-dashed outline-1 -outline-offset-1 outline-current" };

/**
 * Badge du statut administratif d'un membre. Le libellé porte l'information
 * (jamais la couleur seule) ; l'infobulle `title` explique le statut à la souris.
 * `decrire` ajoute l'explication pour les lecteurs d'écran (fiche du membre) —
 * laissé à false dans les tableaux pour ne pas la répéter à chaque ligne.
 */
export function StatutBadge({ statut, decrire = false }) {
  const meta = STATUT_MEMBRE_META[statut] ?? { label: statut, ton: "gris" };
  const aide = STATUT_AIDE[statut];
  return (
    <Badge ton={meta.ton} title={aide} className={`whitespace-nowrap ${FORME[statut] ?? ""}`}>
      <span>{meta.label}</span>
      {decrire && aide && <span className="sr-only"> — {aide}</span>}
    </Badge>
  );
}

StatutBadge.propTypes = { statut: PropTypes.string.isRequired, decrire: PropTypes.bool };

export default StatutBadge;
