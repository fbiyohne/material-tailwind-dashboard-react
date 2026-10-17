import PropTypes from "prop-types";
import { cloneElement, isValidElement } from "react";

/**
 * Champ de formulaire (thème clair) : libellé + marqueur requis + indice +
 * message d'erreur, autour d'un contrôle quelconque (input/select/textarea).
 * Pour l'état d'erreur du contrôle, ajouter la classe `is-invalid` à `bpn-input`.
 *
 * Accessibilité : en présence d'une `error` et d'un `htmlFor`, le message est
 * relié au contrôle (`aria-invalid` + `aria-describedby`) — un lecteur d'écran
 * annonce alors l'erreur sur le champ, pas seulement le liseré rouge.
 */
export function FormField({ label, required, hint, error, full, htmlFor, className = "", children }) {
  const errId = error && htmlFor ? `${htmlFor}-err` : undefined;
  const controle = error && errId && isValidElement(children)
    ? cloneElement(children, {
        "aria-invalid": true,
        "aria-describedby": [children.props["aria-describedby"], errId].filter(Boolean).join(" ") || undefined,
      })
    : children;
  return (
    <label htmlFor={htmlFor} className={`block ${full ? "sm:col-span-2" : ""} ${className}`}>
      <span className="bpn-label">
        {label}{required && <span className="text-rouge"> *</span>}
        {hint && <span className="ml-1 font-normal lowercase tracking-normal text-gris/70">· {hint}</span>}
      </span>
      <div className="mt-1">{controle}</div>
      {error && <p id={errId} role="alert" className="mt-1 text-xs text-rouge">{error}</p>}
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
