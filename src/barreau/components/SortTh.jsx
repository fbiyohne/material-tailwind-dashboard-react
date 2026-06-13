import PropTypes from "prop-types";
import { ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/solid";

/** En-tête de colonne triable (header navy des tableaux). */
export function SortTh({ label, sortKey, current, dir, onSort, className = "", align = "left" }) {
  const active = current === sortKey;
  return (
    <th className={`px-3 py-2.5 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition hover:text-white ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        {active ? (
          dir === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />
        ) : (
          <ChevronUpDownIcon className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

SortTh.propTypes = {
  label: PropTypes.string.isRequired,
  sortKey: PropTypes.string.isRequired,
  current: PropTypes.string,
  dir: PropTypes.string,
  onSort: PropTypes.func.isRequired,
  className: PropTypes.string,
  align: PropTypes.oneOf(["left", "right"]),
};

export default SortTh;
