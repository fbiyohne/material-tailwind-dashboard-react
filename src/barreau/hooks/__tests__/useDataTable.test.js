import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDataTable } from "../useDataTable";

const rows = [
  { id: 1, nom: "C" },
  { id: 2, nom: "A" },
  { id: 3, nom: "B" },
];

describe("useDataTable — tri (existant)", () => {
  it("trie selon l'accessor", () => {
    const { result } = renderHook(() =>
      useDataTable(rows, { accessors: { nom: (r) => r.nom }, initialSort: { key: "nom", dir: "asc" } })
    );
    expect(result.current.rows.map((r) => r.nom)).toEqual(["A", "B", "C"]);
  });
});

describe("useDataTable — pagination", () => {
  const dix = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

  it("pagine par défaut selon pageSize", () => {
    const { result } = renderHook(() => useDataTable(dix, { pageSize: 10 }));
    expect(result.current.rows).toHaveLength(10);
    expect(result.current.totalPages).toBe(3);
  });

  it("pageSize ≤ 0 rend toutes les lignes sur une seule page", () => {
    const { result } = renderHook(() => useDataTable(dix, { pageSize: 0 }));
    expect(result.current.rows).toHaveLength(25);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.total).toBe(25);
  });
});

describe("useDataTable — sélection (nouveau)", () => {
  it("sélectionne et désélectionne une ligne", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleRow(2));
    expect(result.current.selectedIds).toEqual([2]);
    act(() => result.current.toggleRow(2));
    expect(result.current.selectedIds).toEqual([]);
  });

  it("toggleAllVisible sélectionne les lignes de la page courante", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleAllVisible());
    expect(result.current.selectedIds.sort()).toEqual([1, 2, 3]);
    expect(result.current.allVisibleSelected).toBe(true);
    act(() => result.current.toggleAllVisible());
    expect(result.current.selectedIds).toEqual([]);
  });

  it("clearSelection vide la sélection", () => {
    const { result } = renderHook(() => useDataTable(rows, { getRowId: (r) => r.id }));
    act(() => result.current.toggleRow(1));
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
  });
});
