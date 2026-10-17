import PropTypes from "prop-types";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

/** Pagination compacte sous un tableau. */
export function Pagination({ page, totalPages, total, onPage, libelle = "éléments" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-grisM px-4 py-2.5 text-xs text-gris">
      <span>
        {total} {libelle}
        {totalPages > 1 ? ` · page ${page}/${totalPages}` : ""}
      </span>
      {totalPages > 1 && (
        <div className="flex gap-1.5">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="bpn-btn bpn-btn-ghost !px-2 !py-1" aria-label="Page précédente">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="bpn-btn bpn-btn-ghost !px-2 !py-1" aria-label="Page suivante">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

Pagination.propTypes = {
  page: PropTypes.number,
  totalPages: PropTypes.number,
  total: PropTypes.number,
  onPage: PropTypes.func,
  libelle: PropTypes.string,
};

export default Pagination;
