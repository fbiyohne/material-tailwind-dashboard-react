import PropTypes from "prop-types";

/**
 * Section de formulaire (thème clair) : en-tête (icône + titre + filet) suivi
 * d'une grille à 1 ou 2 colonnes. Uniformise le découpage des formulaires.
 */
export function FormSection({ icon: Icon, titre, cols = 2, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-b border-grisM pb-1.5">
        {Icon && <Icon className="h-4 w-4 text-or" />}
        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-navy">{titre}</h4>
      </div>
      <div className={`grid grid-cols-1 gap-3 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </section>
  );
}

FormSection.propTypes = {
  icon: PropTypes.elementType,
  titre: PropTypes.string.isRequired,
  cols: PropTypes.oneOf([1, 2]),
  children: PropTypes.node,
};

export default FormSection;
