import { useEffect, useMemo, useState } from "react";

/**
 * Tri + pagination pour un tableau de données.
 * `accessors` : map clé → fonction d'extraction de la valeur triable.
 * Pensé pour des volumes type 139 membres.
 */
export function useDataTable(rows, { accessors = {}, pageSize = 10, initialSort, getRowId } = {}) {
  const [sortKey, setSortKey] = useState(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState(initialSort?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

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

  // La pagination revient à la 1re page quand la TAILLE du jeu de données change
  // (filtre/recherche/onglet, ajout/suppression) — on se cale sur la longueur,
  // pas sur l'identité du tableau, pour ne pas réinitialiser à chaque rendu.
  useEffect(() => { setPage(1); }, [sorted.length]);

  // pageSize ≤ 0 ou non fini ⇒ pas de pagination : toutes les lignes triées sont
  // rendues (listes imprimées en intégralité — annuaire, liste électorale…).
  const paginate = Number.isFinite(pageSize) && pageSize > 0;
  const totalPages = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const current = Math.min(page, totalPages);
  const pageRows = paginate ? sorted.slice((current - 1) * pageSize, current * pageSize) : sorted;

  const rowId = getRowId ?? ((r) => r.id);
  // La sélection est bornée aux lignes réellement présentes dans le jeu courant :
  // après un filtre, les actions groupées (export…) n'agissent jamais sur des IDs
  // devenus invisibles.
  const idsPresents = useMemo(() => new Set(sorted.map(rowId)), [sorted, rowId]);
  const selectedIds = [...selected].filter((id) => idsPresents.has(id));
  const toggleRow = (id) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const visibleIds = pageRows.map(rowId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggleAllVisible = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (visibleIds.every((id) => next.has(id))) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  return {
    rows: pageRows, total: sorted.length, page: current, setPage, totalPages,
    sortKey, sortDir, toggleSort,
    selectedIds, toggleRow, toggleAllVisible, allVisibleSelected, clearSelection,
  };
}

export default useDataTable;
