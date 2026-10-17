import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { identite, logoInstitution, onConfigChange } from "../data/config";

/**
 * Logo officiel du Barreau — source unique (Paramètres). Si un logo a été
 * téléversé, il est affiché partout ; sinon le logo officiel (public/img/logo-barreau.png). Réagit aux
 * changements de configuration (mise à jour immédiate après enregistrement).
 */
export function Sceau({ size = 84 }) {
  // Re-rend le composant lorsque la configuration vivante change (logo/texte).
  const [, forcer] = useState(0);
  useEffect(() => onConfigChange(() => forcer((n) => n + 1)), []);

  // Logo téléversé dans les Paramètres, sinon logo officiel du Barreau (public/img).
  const televerse = logoInstitution();
  const logo = televerse || "/img/logo-barreau.png";
  return (
    <img
      src={logo}
      alt={`Logo — ${identite().denomination}`}
      width={size}
      height={size}
      // Logo officiel rond : coins du fichier source masqués.
      style={{ width: size, height: size, objectFit: "contain", ...(televerse ? {} : { borderRadius: "50%" }) }}
    />
  );
}

Sceau.propTypes = { size: PropTypes.number };

export default Sceau;
