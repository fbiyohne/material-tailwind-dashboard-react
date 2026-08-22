import PropTypes from "prop-types";

/**
 * Carte indicateur du tableau de bord.
 * Liseré gauche coloré (`accent`) + valeur en Playfair Display dont la couleur
 * peut différer (`valueAccent`). Si `onClick` est fourni, la carte devient
 * cliquable (navigation vers une liste filtrée).
 */
export function StatCard({ label, value, sub, accent = "or", valueAccent, onClick, className = "", index = 0 }) {
  const valueColor = valueAccent ?? accent;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bpn-stat block w-full text-left ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-or/40" : ""} ${className}`}
      style={{ borderLeftColor: `var(--bpn-${accent})`, animationDelay: index ? `${Math.min(index, 8) * 55}ms` : undefined }}
    >
      <div className="bpn-stat-label">{label}</div>
      <div className="bpn-stat-value" style={{ color: `var(--bpn-${valueColor})` }}>
        {value}
      </div>
      {sub && <div className="bpn-stat-sub">{sub}</div>}
    </Tag>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sub: PropTypes.string,
  accent: PropTypes.string,
  valueAccent: PropTypes.string,
  onClick: PropTypes.func,
  className: PropTypes.string,
  index: PropTypes.number,
};

export default StatCard;
