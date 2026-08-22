import PropTypes from "prop-types";
import { Badge } from "./Badge";
import { STATUT_MEMBRE_META } from "../data/derivations";

/** Badge du statut administratif d'un membre (inscrit, suspendu, honoraire…). */
export function StatutBadge({ statut }) {
  const meta = STATUT_MEMBRE_META[statut] ?? { label: statut, ton: "gris" };
  return <Badge ton={meta.ton}>{meta.label}</Badge>;
}

StatutBadge.propTypes = { statut: PropTypes.string.isRequired };

export default StatutBadge;
