import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { navSections } from "../routes";

/**
 * Sidebar institutionnelle marine & or — reproduction fidèle de la maquette.
 * Élément actif : bordure gauche or + fond teinté + libellé or (annotation 1
 * de la maquette « Navigation active »). Off-canvas sur mobile.
 */
export function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Voile mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-3/60 xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-y-auto bg-navy-3 transition-transform duration-300 xl:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Bloc logo */}
        <div className="relative border-b border-white/[0.08] px-4 pb-5 pt-6">
          <div className="mb-1 text-[8px] uppercase tracking-[0.3em] text-or">
            République du Congo
          </div>
          <div className="font-display text-[15px] leading-tight text-white">
            Barreau de
            <br />
            Pointe-Noire
          </div>
          <div className="mt-1 text-[9px] text-white/40">Secrétariat Général</div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-5 text-white/40 hover:text-white xl:hidden"
            aria-label="Fermer le menu"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Sections de navigation */}
        <nav className="flex-1 py-3">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-4 pb-1 pt-3 text-[8px] font-medium uppercase tracking-[0.25em] text-or/40">
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 border-l-2 px-4 py-2 text-[12px] transition-all duration-150 ${
                        isActive
                          ? "border-or bg-or/[0.08] text-or-2"
                          : "border-transparent text-white/45 hover:bg-white/5 hover:text-white/80"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-lg bg-rouge px-1.5 text-[8px] font-medium text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/[0.08] px-4 py-3 text-[8px] uppercase tracking-[0.2em] text-white/20">
          Ordre National des Avocats
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
