import PropTypes from "prop-types";

/**
 * Champ de formulaire (thème clair) : libellé + marqueur requis + indice +
 * message d'erreur, autour d'un contrôle quelconque (input/select/textarea).
 * Pour l'état d'erreur du contrôle, ajouter la classe `is-invalid` à `bpn-input`.
 */
export function FormField({ label, required, hint, error, full, htmlFor, className = "", children }) {
  return (
    <label htmlFor={htmlFor} className={`block ${full ? "sm:col-span-2" : ""} ${className}`}>
      <span className="bpn-label">
        {label}{required && <span className="text-rouge"> *</span>}
        {hint && <span className="ml-1 font-normal lowercase tracking-normal text-gris/70">· {hint}</span>}
      </span>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-[11px] text-rouge">{error}</p>}
    </label>
  );
}

FormField.propTypes = {
  label: PropTypes.string.isRequired,
  required: PropTypes.bool,
  hint: PropTypes.string,
  error: PropTypes.string,
  full: PropTypes.bool,
  htmlFor: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default FormField;
