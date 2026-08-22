import PropTypes from "prop-types";

/** Bloc squelette (chargement). Respecte prefers-reduced-motion via la classe. */
export function Skeleton({ className = "" }) {
  return <div className={`bpn-skeleton ${className}`} aria-hidden="true" />;
}
Skeleton.propTypes = { className: PropTypes.string };

/** Squelette de table (N lignes × M colonnes) pour l'état de chargement. */
export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="divide-y divide-grisL" role="status" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-3 py-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-3.5 ${c === 1 ? "flex-[2]" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
TableSkeleton.propTypes = { rows: PropTypes.number, cols: PropTypes.number };

export default Skeleton;
