import PropTypes from "prop-types";

const TONS = {
  vert: "bpn-badge-vert",
  rouge: "bpn-badge-rouge",
  or: "bpn-badge-or",
  gris: "bpn-badge-gris",
  bleu: "bpn-badge-bleu",
};

/**
 * Pastille de statut institutionnelle.
 * Conforme à l'accessibilité de la maquette : l'information n'est jamais portée
 * par la seule couleur — une pastille (dot) accompagne toujours le libellé.
 */
export function Badge({ ton = "gris", dot = true, children, className = "" }) {
  return (
    <span className={`bpn-badge ${TONS[ton]} ${className}`}>
      {dot && <span className="bpn-badge-dot" />}
      {children}
    </span>
  );
}

Badge.propTypes = {
  ton: PropTypes.oneOf(["vert", "rouge", "or", "gris", "bleu"]),
  dot: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default Badge;
