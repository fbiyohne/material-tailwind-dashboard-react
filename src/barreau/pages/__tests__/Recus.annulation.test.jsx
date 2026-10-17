import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Recus, COLONNES_CSV } from "../Recus";

// R2-5 — un reçu annulé reste au registre, marqué « Annulé », sans PDF ni bouton d'annulation.
vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
  listerRecus: vi.fn().mockResolvedValue([
    { id: 1, numero: "R-2026-0001", montant: 1000, annee: 2026, date: "2026-10-01", objet: null, statut: "EMIS", membre: { nom: "Alpha", num: 1 }, verif: "/v/r/R-2026-0001.AAAAAAAAAA" },
    { id: 2, numero: "R-2026-0002", montant: 1000, annee: 2026, date: "2026-10-02", objet: null, statut: "ANNULE", motifAnnulation: "Saisie en double", membre: { nom: "Beta", num: 2 }, verif: "/v/r/R-2026-0002.BBBBBBBBBB" },
  ]),
  enregistrerPaiement: vi.fn(),
  annulerRecu: vi.fn(),
  telechargerRecuPdf: vi.fn(),
}));

describe("Registre des reçus — annulation logique", () => {
  it("affiche le badge Annulé et retire PDF et Annuler pour ce seul reçu", async () => {
    render(<MemoryRouter><ToastProvider><ConfirmProvider><Recus /></ConfirmProvider></ToastProvider></MemoryRouter>);
    expect(await screen.findByText("Annulé")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler le reçu N° R-2026-0001" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annuler le reçu N° R-2026-0002" })).toBeNull();
    expect(screen.getAllByTitle("Télécharger le reçu (PDF)")).toHaveLength(1);
  });

  it("l'export CSV porte une colonne Statut : un reçu annulé n'est pas confondu avec un encaissement", () => {
    const statut = COLONNES_CSV.find((c) => c.label === "Statut");
    expect(statut).toBeDefined();
    expect(statut.valeur({ statut: "ANNULE", annuleLe: "2026-10-05" })).toMatch(/^Annulé le /);
    expect(statut.valeur({ statut: "EMIS" })).toBe("Émis");
  });
});
