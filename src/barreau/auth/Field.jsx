import PropTypes from "prop-types";

/**
 * Champ de formulaire des pages d'authentification (fond sombre) :
 * micro-libellé capitales, icône à gauche, adornement optionnel à droite
 * (ex. afficher/masquer), et message d'erreur accessible (aria-describedby).
 */
export function Field({ id, label, icon: Icon, error, hint, trailing, as = "input", className = "", children, ...props }) {
  const Tag = as;
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-2xs font-medium uppercase tracking-[0.18em] text-white/45">{label}</label>
        {hint && <span id={`${id}-hint`} className="text-2xs lowercase tracking-normal text-white/30">{hint}</span>}
      </div>
      <div className="relative">
        {Icon && as === "input" && (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        )}
        <Tag
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`auth-input ${error ? "is-error" : ""} ${trailing ? "!pr-11" : ""} ${className}`}
          {...props}
        >
          {children}
        </Tag>
        {trailing && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-[#e7a39f]">{error}</p>
      )}
    </div>
  );
}

Field.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  error: PropTypes.string,
  hint: PropTypes.string,
  trailing: PropTypes.node,
  as: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default Field;
