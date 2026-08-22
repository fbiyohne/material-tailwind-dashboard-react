import PropTypes from "prop-types";

const VARIANTS = {
  primary: "bpn-btn-primary",
  or: "bpn-btn-or",
  ghost: "bpn-btn-ghost",
  danger: "bpn-btn-danger",
};

/**
 * Bouton institutionnel avec états (chargement, désactivé) — couvre la
 * section « États » de la maquette (spinner inline pendant une action).
 */
export function Button({ variant = "primary", loading = false, disabled = false, children, className = "", ...props }) {
  return (
    <button
      className={`bpn-btn ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span className="inline-block h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

Button.propTypes = {
  variant: PropTypes.oneOf(["primary", "or", "ghost", "danger"]),
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  children: PropTypes.node,
  className: PropTypes.string,
};

export default Button;
