import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

/**
 * Menu déroulant « Actions » (role=menu). Entrées :
 * { id, libelle, Icon?, onSelect, disabled?, motif? (info-bulle si désactivée), danger?, separe? }.
 * Classes reprises du menu d'export de pages/Avocats.jsx (REFERENCE-UI).
 * pleineLargeurMobile : sous `sm`, panneau sur toute la largeur de l’écran (marges de 16 px) sous le
 * bouton, quelle que soit sa position dans la ligne ; au-delà, ancré à droite du bouton.
 */
export function MenuActions({ entrees, libelle = "Actions", petit = false, pleineLargeurMobile = false }) {
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef(null);
  const bouton = useRef(null);
  const items = useRef([]);
  const actifs = () => items.current.filter((el) => el && el.getAttribute("aria-disabled") !== "true");

  const fermer = (rendreFocus = true) => {
    setOuvert(false);
    if (rendreFocus) bouton.current?.focus();
  };

  useEffect(() => {
    if (!ouvert) return undefined;
    actifs()[0]?.focus();
    const dehors = (e) => { if (!racine.current?.contains(e.target)) setOuvert(false); };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert]);

  const clavier = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); fermer(); return; }
    if (e.key === "Tab") { setOuvert(false); return; }
    const liste = actifs();
    const i = liste.indexOf(document.activeElement);
    const cible = { ArrowDown: liste[(i + 1) % liste.length], ArrowUp: liste[(i - 1 + liste.length) % liste.length],
      Home: liste[0], End: liste[liste.length - 1] }[e.key];
    if (cible) { e.preventDefault(); cible.focus(); }
  };

  return (
    <div ref={racine} className={pleineLargeurMobile ? "inline-block sm:relative" : "relative inline-block"} onKeyDown={ouvert ? clavier : undefined}>
      <button ref={bouton} type="button" aria-haspopup="menu" aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !ouvert) { e.preventDefault(); setOuvert(true); } }}
        className={`bpn-btn bpn-btn-ghost ${petit ? "bpn-btn-sm" : "min-h-[44px] sm:min-h-0"}`}>
        {libelle} <ChevronDownIcon className="h-3 w-3" aria-hidden="true" />
      </button>
      {ouvert && (
        <div role="menu" aria-label={libelle}
          className={`absolute ${pleineLargeurMobile ? "left-4 right-4 sm:left-auto sm:right-0 sm:w-80" : "right-0 w-72"} z-20 mt-1 max-h-[70vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded border border-grisM bg-white p-1 text-left shadow-card`}>
          {entrees.map((en, n) => (
            <div key={en.id} role="none" className={en.separe && n > 0 ? `mt-1 border-t pt-1 ${en.danger ? "border-rouge/30" : "border-grisM"}` : undefined}>
              <button type="button" role="menuitem" tabIndex={-1} ref={(el) => { items.current[n] = el; }}
                aria-disabled={en.disabled ? "true" : undefined}
                title={en.disabled ? en.motif : undefined}
                onClick={() => { if (en.disabled) return; fermer(); en.onSelect?.(); }}
                className={`inline-flex min-h-[44px] w-full items-center gap-2 rounded px-3 text-sm ${
                  en.danger ? "text-rouge hover:bg-rougeL" : "text-encre hover:bg-grisL"} ${en.disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                {en.Icon && <en.Icon className="h-4 w-4" aria-hidden="true" />}
                <span className="flex-1 text-left">{en.libelle}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
