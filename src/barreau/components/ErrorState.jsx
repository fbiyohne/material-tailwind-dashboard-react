import PropTypes from "prop-types";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

/** État d'erreur réutilisable avec action de réessai. */
export function ErrorState({ title = "Impossible de charger les données", description, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rougeL text-rouge">
        <ExclamationTriangleIcon className="h-6 w-6" />
      </div>
      <p className="font-display text-base text-rouge">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gris">{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="bpn-btn bpn-btn-ghost mt-4">
          Réessayer
        </button>
      )}
    </div>
  );
}

ErrorState.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  onRetry: PropTypes.func,
};

export default ErrorState;
