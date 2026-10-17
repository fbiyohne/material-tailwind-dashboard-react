import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

/** Fil d'Ariane discret pour le wayfinding (pages de détail). */
export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex items-center gap-1 text-xs text-gris">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {it.to && !last ? (
              <Link to={it.to} className="transition hover:text-navy">{it.label}</Link>
            ) : (
              <span aria-current={last ? "page" : undefined} className={last ? "text-encre" : ""}>{it.label}</span>
            )}
            {!last && <ChevronRightIcon className="h-3 w-3 text-grisM" />}
          </span>
        );
      })}
    </nav>
  );
}

Breadcrumb.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string.isRequired, to: PropTypes.string })).isRequired,
};

export default Breadcrumb;
