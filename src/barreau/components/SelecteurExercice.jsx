import PropTypes from "prop-types";
import { EXERCICES } from "../data/dashboard-data";

/**
 * Sélecteur d'exercice réutilisable (pastilles marine/or), pour les en-têtes
 * de modules financiers. Source unique de l'apparence — évite la duplication
 * du même balisage dans Tableau de bord, Corps électoral, Droits de plaidoirie…
 */
export function SelecteurExercice({ valeur, onChange, label = "Exercice", className = "" }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {label && <span className="bpn-label mr-1">{label}</span>}
      {EXERCICES.map((annee) => (
        <button
          key={annee}
          type="button"
          onClick={() => onChange(annee)}
          aria-pressed={annee === valeur}
          className={`rounded px-3 py-1 font-mono text-xs transition ${
            annee === valeur ? "bg-navy text-white" : "bg-grisL text-gris hover:bg-grisM hover:text-encre"
          }`}
        >
          {annee}
        </button>
      ))}
    </div>
  );
}

SelecteurExercice.propTypes = {
  valeur: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default SelecteurExercice;
