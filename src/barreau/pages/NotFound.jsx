import { Link } from "react-router-dom";
import { ExclamationTriangleIcon, HomeIcon } from "@heroicons/react/24/outline";

/** Page 404 — chemin inconnu (au lieu d'une redirection silencieuse). */
export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="bpn-eyebrow justify-center">Erreur 404</div>
      <ExclamationTriangleIcon className="mt-4 h-12 w-12 text-or" />
      <h2 className="bpn-title mt-4">Page introuvable</h2>
      <p className="mt-2 max-w-md text-sm text-gris">
        La page demandée n'existe pas ou a été déplacée. Vérifiez l'adresse ou revenez au tableau de bord.
      </p>
      <Link to="/" className="bpn-btn bpn-btn-primary mt-6">
        <HomeIcon className="h-4 w-4" /> Retour au tableau de bord
      </Link>
    </div>
  );
}

export default NotFound;
