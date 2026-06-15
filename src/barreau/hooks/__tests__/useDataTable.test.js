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
