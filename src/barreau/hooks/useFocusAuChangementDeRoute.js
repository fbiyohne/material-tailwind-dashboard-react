import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Au changement de route : ramène le défilement en haut et déplace le focus sur
 * le conteneur principal (qui doit porter tabIndex={-1}). Sans cela, les
 * utilisateurs clavier / lecteurs d'écran restent « coincés » à la position
 * précédente après chaque navigation côté client. Renvoie le ref à poser sur
 * l'élément <main>.
 */
export function useFocusAuChangementDeRoute() {
  const { pathname } = useLocation();
  const ref = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    ref.current?.focus({ preventScroll: true });
  }, [pathname]);
  return ref;
}

export default useFocusAuChangementDeRoute;
