import PropTypes from "prop-types";

/**
 * En-tête de page institutionnel : eyebrow + titre + sous-titre, avec une zone
 * d'actions optionnelle à droite (`children`). Uniformise l'en-tête répété sur
 * l'ensemble des pages.
 */
export function PageHeader({ eyebrow, titre, sousTitre, className = "", children }) {
  return (
    <div className={`flex flex-col justify-between gap-3 sm:flex-row sm:items-end ${className}`}>
      <div>
        {eyebrow && <div className="bpn-eyebrow">{eyebrow}</div>}
        <h2 className="bpn-title mt-2">{titre}</h2>
        {sousTitre && <p className="mt-1 text-sm text-gris">{sousTitre}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{children}</div>}
    </div>
  );
}

PageHeader.propTypes = {
  eyebrow: PropTypes.string,
  titre: PropTypes.node.isRequired,
  sousTitre: PropTypes.node,
  className: PropTypes.string,
  children: PropTypes.node,
};

export default PageHeader;
