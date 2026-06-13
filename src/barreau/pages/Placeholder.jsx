import PropTypes from "prop-types";
import { WrenchScrewdriverIcon } from "@heroicons/react/24/outline";

/**
 * Écran transitoire pour les modules non encore développés (Étapes ≥ 2).
 * Conserve l'identité institutionnelle pour que la navigation soit cohérente
 * dès l'Étape 1.
 */
export function Placeholder({ title }) {
  return (
    <div>
      <div className="bpn-eyebrow">Module</div>
      <h2 className="bpn-title mt-2">{title}</h2>

      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-grisM bg-white px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-or-L text-or">
          <WrenchScrewdriverIcon className="h-6 w-6" />
        </div>
        <p className="font-display text-lg text-navy">Module en cours de développement</p>
        <p className="mt-2 max-w-md text-sm text-gris">
          L'écran « {title} » sera livré lors d'une prochaine étape. Le socle visuel
          et la navigation sont déjà en place.
        </p>
      </div>
    </div>
  );
}

Placeholder.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Placeholder;
