import PropTypes from "prop-types";

const TONS = {
  or: { box: "border-or bg-or-L text-gris", icon: "text-or" },
  rouge: { box: "border-rouge bg-[#f4e6e6] text-rouge", icon: "text-rouge" },
  vert: { box: "border-vert bg-[#e6f4ee] text-vert", icon: "text-vert" },
  bleu: { box: "border-navy bg-[#e6edf4] text-navy", icon: "text-navy" },
  gris: { box: "border-grisM bg-grisL text-gris", icon: "text-gris" },
};

/**
 * Encart d'information / alerte (thème clair), bordé à gauche. Uniformise les
 * bandeaux info (or), erreur (rouge), succès (vert), etc.
 */
export function Notice({ ton = "or", icon: Icon, role, className = "", children }) {
  const t = TONS[ton] ?? TONS.or;
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-md border-l-[3px] px-3 py-2.5 text-xs ${t.box} ${className}`}>
      {Icon && <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${t.icon}`} />}
      <div>{children}</div>
    </div>
  );
}

Notice.propTypes = {
  ton: PropTypes.oneOf(["or", "rouge", "vert", "bleu", "gris"]),
  icon: PropTypes.elementType,
  role: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Notice;
