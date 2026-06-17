import { useId, useRef, useState } from "react";
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
 */
export function Tabs({ tabs, defaultTab, className = "", ariaLabel = "Sections" }) {
  const base = useId();
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const refs = useRef({});

  const index = Math.max(0, tabs.findIndex((t) => t.id === active));
  const courant = tabs[index] ?? tabs[0];

  const onKeyDown = (e) => {
    const last = tabs.length - 1;
    let next = null;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    refs.current[id]?.focus();
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 border-b border-grisM"
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
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-or text-navy"
                  : "border-transparent text-gris hover:border-grisM hover:text-encre"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
              {t.badge != null && (
                <span className="ml-0.5 rounded-full bg-grisL px-1.5 py-0.5 text-[11px] font-semibold text-gris">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {courant && (
        <div
          role="tabpanel"
          id={`${base}-panel-${courant.id}`}
          aria-labelledby={`${base}-tab-${courant.id}`}
          tabIndex={0}
          className="pt-5 outline-none"
        >
          {typeof courant.content === "function" ? courant.content() : courant.content}
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
};

export default Tabs;
