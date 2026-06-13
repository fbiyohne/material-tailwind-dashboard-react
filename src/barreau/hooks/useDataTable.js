import { useMemo, useState } from "react";

/**
 * Tri + pagination pour un tableau de données.
 * `accessors` : map clé → fonction d'extraction de la valeur triable.
 * Pensé pour des volumes type 139 membres.
 */
export function useDataTable(rows, { accessors = {}, pageSize = 10, initialSort } = {}) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState(initialSort?.dir ?? "asc");
  const [page, setPage] = useState(1);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    const acc = accessors[sortKey];
    if (!acc) return rows;
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      if (va == null && vb == null) return 0;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, sortDir, accessors]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);

  return { rows: pageRows, total: sorted.length, page: current, setPage, totalPages, sortKey, sortDir, toggleSort };
}

export default useDataTable;
