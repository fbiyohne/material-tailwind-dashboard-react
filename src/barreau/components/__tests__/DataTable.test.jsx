import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "../DataTable";

const columns = [
  { key: "nom", label: "Nom", sortable: true, sortValue: (r) => r.nom, cell: (r) => r.nom },
  { key: "montant", label: "Montant", align: "right", cell: (r) => r.montant },
];
const rows = [
  { id: 1, nom: "BAKALA", montant: 100 },
  { id: 2, nom: "ANGO", montant: 200 },
];

describe("DataTable", () => {
  it("affiche le squelette en chargement", () => {
    render(<DataTable columns={columns} rows={[]} loading getRowId={(r) => r.id} />);
    expect(screen.getByLabelText("Chargement")).toBeInTheDocument();
  });

  it("affiche l'erreur avec réessai", async () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} rows={[]} error onRetry={onRetry} getRowId={(r) => r.id} />);
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("affiche l'état vide", () => {
    render(<DataTable columns={columns} rows={[]} emptyTitle="Aucun élément" getRowId={(r) => r.id} />);
    expect(screen.getByText("Aucun élément")).toBeInTheDocument();
  });

  it("rend les lignes et trie au clic sur l'en-tête", async () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} />);
    expect(screen.getAllByRole("row")).toHaveLength(3); // 1 en-tête + 2 lignes
    await userEvent.click(screen.getByRole("button", { name: /Nom/ }));
    const cells = screen.getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("ANGO");
  });

  it("sélectionne une ligne et affiche la barre d'actions groupées", async () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        selectable
        renderBulkActions={(ids) => <span>{ids.length} sélectionné(s)</span>}
      />
    );
    const cases = screen.getAllByRole("checkbox");
    await userEvent.click(cases[1]); // 1re ligne (cases[0] = tout sélectionner)
    expect(screen.getAllByText("1 sélectionné(s)").length).toBeGreaterThan(0);
  });
});
