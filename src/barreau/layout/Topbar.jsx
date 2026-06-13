import PropTypes from "prop-types";
import {
  Bars3Icon,
  DocumentTextIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

/**
 * Barre supérieure : titre de la page courante (Playfair Display) + actions
 * institutionnelles, reprises de la maquette (« Document », « + Avocat »).
 */
export function Topbar({ title, onOpenMenu }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-grisM bg-white/95 px-4 backdrop-blur md:px-5">
      <button
        type="button"
        onClick={onOpenMenu}
        className="text-navy hover:text-or xl:hidden"
        aria-label="Ouvrir le menu"
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      <h1 className="flex-1 truncate font-display text-lg text-navy">{title}</h1>

      <button type="button" className="bpn-btn bpn-btn-ghost">
        <DocumentTextIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Document</span>
      </button>
      <button type="button" className="bpn-btn bpn-btn-or">
        <PlusIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Avocat</span>
      </button>
    </header>
  );
}

Topbar.propTypes = {
  title: PropTypes.string,
  onOpenMenu: PropTypes.func,
};

export default Topbar;
