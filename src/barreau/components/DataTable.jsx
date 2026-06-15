import PropTypes from "prop-types";
import { ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useDataTable } from "../hooks/useDataTable";
import { TableSkeleton } from "./Skeleton";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";
import { Pagination } from "./Pagination";

const alignCls = { right: "text-right", center: "text-center", left: "text-left" };

export function DataTable({
  columns, rows, getRowId = (r) => r.id, pageSize = 10, initialSort,
  loading = false, error = false, onRetry, emptyTitle = "Aucun élément", emptyDescription,
  selectable = false, renderBulkActions, density = "confort", libelle = "éléments",
}) {
  const accessors = Object.fromEntries(
    columns.filter((c) => c.sortable && c.sortValue).map((c) => [c.key, c.sortValue])
  );
  const t = useDataTable(rows, { accessors, pageSize, initialSort, getRowId });
  const pad = density === "compact" ? "px-3 py-1.5" : "px-3 py-2.5";

  if (loading) return <TableSkeleton cols={columns.length + (selectable ? 1 : 0)} />;
  if (error) return <ErrorState onRetry={onRetry} />;
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <>
      {selectable && t.selectedIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-grisM bg-bleuL/60 px-3 py-2 text-sm">
          <span className="font-medium text-navy">{t.selectedIds.length} sélectionné(s)</span>
          <div className="flex items-center gap-2">
            {renderBulkActions?.(t.selectedIds, t.clearSelection)}
            <button type="button" onClick={t.clearSelection} className="text-xs text-gris hover:text-encre">Effacer</button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="bpn-table">
          <thead className="sticky top-0 z-10">
            <tr>
              {selectable && (
                <th className={`${pad} w-10`}>
                  <input type="checkbox" aria-label="Tout sélectionner" checked={t.allVisibleSelected}
                    onChange={t.toggleAllVisible} className="h-4 w-4 accent-navy" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`${pad} ${alignCls[c.align] ?? "text-left"}`}>
                  {c.sortable ? (
                    <button type="button" onClick={() => t.toggleSort(c.key)}
                      className="inline-flex items-center gap-1 font-medium uppercase hover:text-white">
                      {c.label}
                      {t.sortKey === c.key
                        ? (t.sortDir === "asc" ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />)
                        : <ChevronUpDownIcon className="h-3 w-3 opacity-60" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row) => {
              const id = getRowId(row);
              const sel = t.selectedIds.includes(id);
              return (
                <tr key={id} className={sel ? "bg-bleuL/40" : "hover:bg-grisL/50"}>
                  {selectable && (
                    <td className={pad}>
                      <input type="checkbox" aria-label={`Sélectionner ${id}`} checked={sel}
                        onChange={() => t.toggleRow(id)} className="h-4 w-4 accent-navy" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`${pad} ${alignCls[c.align] ?? "text-left"}`}>{c.cell(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={t.page} totalPages={t.totalPages} total={t.total} onPage={t.setPage} libelle={libelle} />
    </>
  );
}

DataTable.propTypes = {
  columns: PropTypes.array.isRequired,
  rows: PropTypes.array.isRequired,
  getRowId: PropTypes.func,
  pageSize: PropTypes.number,
  initialSort: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.bool,
  onRetry: PropTypes.func,
  emptyTitle: PropTypes.string,
  emptyDescription: PropTypes.string,
  selectable: PropTypes.bool,
  renderBulkActions: PropTypes.func,
  density: PropTypes.oneOf(["confort", "compact"]),
  libelle: PropTypes.string,
};

export default DataTable;
