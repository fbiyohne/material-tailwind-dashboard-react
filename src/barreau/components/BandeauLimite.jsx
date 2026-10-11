import { useAuth } from "../auth/AuthContext";

/**
 * Blocage temporaire du serveur (429) : délai restant affiché sous l'en-tête, sur tous les écrans
 * (back-office et espace avocat), au lieu d'un chargement ou d'une erreur sans explication (R2-13).
 * Même gabarit que BandeauDemonstration, ton rouge des Notice.
 */
export function BandeauLimite() {
  const { limite } = useAuth();
  if (!limite) return null;
  return (
    <div role="status" aria-live="polite" className="border-b border-rouge bg-rougeL px-4 py-1.5 text-center text-xs text-rouge md:px-6">
      Trop de requêtes, réessayez dans {limite} s.
    </div>
  );
}

export default BandeauLimite;
