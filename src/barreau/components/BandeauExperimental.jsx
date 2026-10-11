import { BeakerIcon } from "@heroicons/react/24/outline";

/** Texte exact imposé par l'avis juridique (écrans du vote et du timbre autonome). */
export const TEXTE_EXPERIMENTAL =
  "Expérimental — non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué.";

/** Texte propre au timbre autonome (C-11/C-12) : ne reprend pas la formule du vote. */
export const TEXTE_EXPERIMENTAL_TIMBRE =
  "Expérimental — prototype : aucun timbre n'est émis et aucun paiement réel n'est effectué.";

/**
 * Bandeau des prototypes (timbre autonome, vote électronique) : à poser en tête
 * de CHAQUE écran concerné (CA13). Pas de bouton de fermeture : l'avertissement
 * doit rester visible pendant toute la démonstration.
 */
export function BandeauExperimental({ variante }) {
  const timbre = variante === "timbre";
  return (
    <div
      role="note"
      aria-label="Avertissement : fonctionnalité expérimentale"
      className="flex items-start gap-3 rounded-md border border-or bg-or-L px-4 py-3 text-sm text-encre"
    >
      <BeakerIcon className="mt-0.5 h-5 w-5 shrink-0 text-or-fonce" aria-hidden="true" />
      <p>
        <strong className="font-semibold text-or-fonce">Expérimental</strong>{" "}
        {timbre
          ? "— prototype : aucun timbre n'est émis et aucun paiement réel n'est effectué."
          : "— non utilisable pour un scrutin officiel ou une émission réelle. Aucun paiement réel n'est effectué."}
      </p>
    </div>
  );
}

export default BandeauExperimental;
