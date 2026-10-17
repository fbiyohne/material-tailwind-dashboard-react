import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

/**
 * Aperçu d'un document à gabarit fixe (largeur px) : réduit à la largeur disponible
 * (téléphone) au lieu d'être rogné ; taille réelle dès que la place suffit et à l'impression.
 */
export function ApercuAjuste({ largeur = 820, children }) {
  const boite = useRef(null);
  const contenu = useRef(null);
  const [m, setM] = useState({ echelle: 1, haut: undefined });

  useEffect(() => {
    const el = boite.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const calcul = () => {
      const echelle = Math.min(1, el.clientWidth / largeur);
      setM({ echelle, haut: echelle < 1 ? (contenu.current?.offsetHeight ?? 0) * echelle : undefined });
    };
    const ro = new ResizeObserver(calcul);
    ro.observe(el);
    if (contenu.current) ro.observe(contenu.current);
    calcul();
    return () => ro.disconnect();
  }, [largeur]);

  const reduit = m.echelle < 1;
  return (
    <div ref={boite} className="w-full overflow-hidden print:!h-auto print:overflow-visible" style={reduit ? { height: m.haut } : undefined}>
      <div
        ref={contenu}
        style={{ width: largeur, "--ech": m.echelle }}
        className={reduit ? "origin-top-left [transform:scale(var(--ech))] print:[transform:none]" : "mx-auto"}
      >
        {children}
      </div>
    </div>
  );
}

ApercuAjuste.propTypes = { largeur: PropTypes.number, children: PropTypes.node };
