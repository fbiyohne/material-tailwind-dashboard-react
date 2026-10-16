import { createContext, useContext, useId, useRef, useState } from "react";
import PropTypes from "prop-types";

/**
 * Onglets institutionnels accessibles (WAI-ARIA Tabs).
 * - Navigation clavier : flèches ←/→, Début/Fin.
 * - Onglet actif : libellé marine + liseré or sous l'onglet.
 *
 * Usage :
 *   <Tabs tabs={[{ id, label, icon?, badge?, content }]} ariaLabel="…" />
 * `content` peut être un nœud ou une fonction (rendu paresseux du panneau actif).
 * `ariaLabel` nomme la liste d'onglets (défaut « Sections ») — à distinguer
 * lorsqu'on imbrique des Tabs pour éviter deux tablists homonymes.
 * `vertical` (écran large uniquement, ≥ lg) : colonne de navigation à gauche,
 * liseré or à droite de l'onglet actif — pour une page à nombreux onglets
 * (Paramètres) qui ne tiendraient pas sur une ligne. Sous lg : rendu horizontal.
 */
// Vrai à l'intérieur d'un panneau : seul le Tabs de premier niveau est collant.
const Imbrique = createContext(false);

export function Tabs({ tabs, defaultTab, className = "", ariaLabel = "Sections", vertical = false }) {
  const base = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const refs = useRef({});
  const imbrique = useContext(Imbrique);
  // Collant sous la Topbar (--haut-collant posé par le layout) ; en colonne, défilement interne si elle déborde.
  const collant = imbrique
    ? ""
    : `sticky top-[var(--haut-collant,0px)] z-20 bg-[var(--fond-collant,#fff)] ${vertical ? "lg:top-[calc(var(--haut-collant,0px)+1rem)] lg:max-h-[calc(100vh-var(--haut-collant,0px)-2rem)] lg:overflow-y-auto" : ""}`;

  const index = Math.max(0, tabs.findIndex((t) => t.id === active));
  const courant = tabs[index] ?? tabs[0];

  const onKeyDown = (e) => {
    const last = tabs.length - 1;
    let next = null;
    if (e.key === "ArrowRight" || (vertical && e.key === "ArrowDown")) next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp")) next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    refs.current[id]?.focus();
  };

  return (
    <div className={`${vertical ? "lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6" : ""} ${className}`}>
      {/* Une seule ligne d'onglets : défilement horizontal interne quand la
          largeur manque (mobile), au lieu d'un retour à la ligne qui casse le
          liseré. Le filet gris est porté par l'enveloppe pour ne pas être rogné. */}
      <div className={collant}>
      <div className={`border-b border-grisM ${vertical ? "lg:border-b-0 lg:border-r" : ""}`}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={`-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] ${vertical ? "lg:-mr-px lg:mb-0 lg:flex-col lg:overflow-visible" : ""}`}
      >
        {tabs.map((t) => {
          const isActive = t.id === courant?.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              ref={(el) => (refs.current[t.id] = el)}
              role="tab"
              type="button"
              id={`${base}-tab-${t.id}`}
              aria-selected={isActive}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(t.id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm sm:px-4 font-medium transition-colors ${vertical ? "lg:border-b-0 lg:border-r-2 lg:pl-0" : ""} ${
                isActive
                  ? "border-or text-navy"
                  : "border-transparent text-gris hover:border-grisM hover:text-encre"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
              {t.badge != null && (
                <span className="ml-0.5 rounded-full bg-grisL px-1.5 py-0.5 text-xs font-semibold text-gris">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </div>
      </div>

      {courant && (
        <div
          role="tabpanel"
          id={`${base}-panel-${courant.id}`}
          aria-labelledby={`${base}-tab-${courant.id}`}
          tabIndex={0}
          className={`pt-5 outline-none ${vertical ? "lg:pt-0" : ""}`}
        >
          <Imbrique.Provider value={true}>
            {typeof courant.content === "function" ? courant.content() : courant.content}
          </Imbrique.Provider>
        </div>
      )}
    </div>
  );
}

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.node.isRequired,
      icon: PropTypes.elementType,
      badge: PropTypes.node,
      content: PropTypes.oneOfType([PropTypes.node, PropTypes.func]).isRequired,
    })
  ).isRequired,
  defaultTab: PropTypes.string,
  className: PropTypes.string,
  ariaLabel: PropTypes.string,
  vertical: PropTypes.bool,
};

export default Tabs;
