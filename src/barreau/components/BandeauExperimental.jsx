import { BeakerIcon } from "@heroicons/react/24/outline";

/** Texte exact imposé par l'avis juridique C-11 pour le vote électronique (variante par défaut). */
export const TEXTE_EXPERIMENTAL =
  "Expérimental — non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué.";

/** Texte C-11 propre au timbre autonome (variante="timbre") : ne reprend pas la formule du scrutin. */
export const TEXTE_EXPERIMENTAL_TIMBRE =
  "Expérimental — prototype : aucun timbre n'est émis et aucun paiement réel n'est effectué.";

/**
 * Bandeau des prototypes (timbre autonome, vote électronique) : à poser en tête
 * de CHAQUE écran concerné (CA13). Pas de bouton de fermeture : l'avertissement
 * doit rester visible pendant toute la démonstration.
 */
export function BandeauExperimental({ variante }) {
  // Source unique : le texte affiché est la constante exportée, « Expérimental » mis en gras.
  const texte = variante === "timbre" ? TEXTE_EXPERIMENTAL_TIMBRE : TEXTE_EXPERIMENTAL;
  const tete = "Expérimental";
  return (
    <div
      role="note"
      aria-label="Avertissement : fonctionnalité expérimentale"
      className="flex items-start gap-3 rounded-md border border-or bg-or-L px-4 py-3 text-sm text-encre"
    >
      <BeakerIcon className="mt-0.5 h-5 w-5 shrink-0 text-or-fonce" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-or-fonce">{tete}</strong>
        {texte.slice(tete.length)}
      </p>
    </div>
  );
}

export default BandeauExperimental;
