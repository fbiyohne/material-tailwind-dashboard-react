import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { identite, logoInstitution, onConfigChange } from "../data/config";

/**
 * Logo officiel du Barreau — source unique (Paramètres). Si un logo a été
 * téléversé, il est affiché partout ; sinon on rend le sceau dessiné (balance)
 * dont le texte reprend la dénomination / l'ordre configurés. Réagit aux
 * changements de configuration (mise à jour immédiate après enregistrement).
 */
export function Sceau({ size = 84 }) {
  // Re-rend le composant lorsque la configuration vivante change (logo/texte).
  const [, forcer] = useState(0);
  useEffect(() => onConfigChange(() => forcer((n) => n + 1)), []);

  const logo = logoInstitution();
  if (logo) {
    return (
      <img
        src={logo}
        alt={`Logo — ${identite().denomination}`}
        width={size}
        height={size}
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    );
  }

  const { denomination, ordre } = identite();
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Sceau — ${denomination}`}>
      <defs>
        <path id="sceau-haut" d="M 18,50 A 32,32 0 0 1 82,50" />
        <path id="sceau-bas" d="M 82,52 A 32,32 0 0 1 18,52" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#C4990A" strokeWidth="1.4" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="#C4990A" strokeWidth="0.6" />
      <text fill="#1A3A6B" fontSize="6" fontWeight="600" letterSpacing="0.8">
        <textPath href="#sceau-haut" startOffset="50%" textAnchor="middle">{(ordre || "").toUpperCase()}</textPath>
      </text>
      <text fill="#1A3A6B" fontSize="6" fontWeight="600" letterSpacing="0.8">
        <textPath href="#sceau-bas" startOffset="50%" textAnchor="middle">{(denomination || "").toUpperCase()}</textPath>
      </text>
      {/* Balance de la justice */}
      <g stroke="#1A3A6B" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <line x1="50" y1="37" x2="50" y2="63" />
        <line x1="44" y1="63" x2="56" y2="63" />
        <line x1="38" y1="42" x2="62" y2="42" />
        <circle cx="50" cy="38" r="1.6" fill="#C4990A" stroke="none" />
        <line x1="38" y1="42" x2="38" y2="49" />
        <path d="M33,49 Q38,54 43,49" />
        <line x1="62" y1="42" x2="62" y2="49" />
        <path d="M57,49 Q62,54 67,49" />
      </g>
    </svg>
  );
}

Sceau.propTypes = { size: PropTypes.number };

export default Sceau;
