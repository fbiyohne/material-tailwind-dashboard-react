import PropTypes from "prop-types";

/**
 * Carte indicateur du tableau de bord.
 * Liseré gauche coloré (`accent`) + valeur en Playfair Display dont la couleur
 * peut différer (`valueAccent`), fidèle à la maquette — ex. « Avocats inscrits »
 * a un liseré or mais une valeur marine.
 * Les accents sont des noms de tokens : navy, or, vert, rouge, gris.
 */
export function StatCard({ label, value, sub, accent = "or", valueAccent }) {
  const valueColor = valueAccent ?? accent;
  return (
    <div className="bpn-stat" style={{ borderLeftColor: `var(--bpn-${accent})` }}>
      <div className="bpn-stat-label">{label}</div>
      <div className="bpn-stat-value" style={{ color: `var(--bpn-${valueColor})` }}>
        {value}
      </div>
      {sub && <div className="bpn-stat-sub">{sub}</div>}
    </div>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sub: PropTypes.string,
  accent: PropTypes.string,
  valueAccent: PropTypes.string,
};

export default StatCard;
