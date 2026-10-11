import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { AnciensMembres } from "../AnciensMembres";
import { Avocats } from "../Avocats";
import { listerMembres, journaliserExport } from "../../api/resources";
import { telechargerTexte } from "../../utils/exportCsv";

vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn(),
  getCotisations: vi.fn().mockResolvedValue([]),
  supprimerMembre: vi.fn(),
  telechargerAvocatsPdf: vi.fn(),
  journaliserExport: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../utils/exportCsv", async (orig) => ({ ...(await orig()), telechargerTexte: vi.fn() }));
vi.mock("../../utils/exports", () => ({ exporterExcel: vi.fn(), exporterPdf: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL", permissions: ["membres"] } }) }));
vi.mock("../../components/AttestationModal", () => ({ AttestationModal: () => null }));

const sortis = [
  { id: 2, numInscription: "PN-2011-002", nom: "NGOMA Paul", qualite: "titulaire", cabinet: "", motifSortie: "Décès", dateSortie: "2026-09-15T00:00:00.000Z" },
  { id: 3, numInscription: "PN-2012-003", nom: "MBEMBA Luc", qualite: "titulaire", cabinet: "Cab X", motifSortie: "Sortie du tableau", dateSortie: "2026-03-01T00:00:00.000Z" },
];
const rendre = (ui) => render(<MemoryRouter><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

describe("Anciens membres", () => {
  it("appelle l'API avec sortis=1, affiche motif, date et le bandeau CL-ANCIENS-MEMBRES", async () => {
    listerMembres.mockResolvedValue({ items: sortis });
    rendre(<AnciensMembres />);
    await screen.findByText("Me NGOMA Paul");
    expect(listerMembres.mock.calls[0][0]).toMatchObject({ sortis: "1" });
    expect(screen.getByRole("cell", { name: "Décès" })).toBeTruthy();
    expect(screen.getByText("Sortie du tableau")).toBeTruthy();
    expect(screen.getByText("15 septembre 2026")).toBeTruthy();
    expect(screen.getByText(/en consultation seule/)).toBeTruthy();
    // Sans permission discipline, le motif « Radiation » n'est pas proposé (R-62).
    expect(screen.queryByRole("option", { name: "Radiation" })).toBeNull();
  });

  it("état vide quand aucun ancien membre", async () => {
    listerMembres.mockResolvedValue({ items: [] });
    rendre(<AnciensMembres />);
    expect(await screen.findByText("Aucun ancien membre")).toBeTruthy();
  });

  it("l'export CSV est journalisé avant le téléchargement", async () => {
    listerMembres.mockResolvedValue({ items: sortis });
    rendre(<AnciensMembres />);
    await screen.findByText("Me NGOMA Paul");
    const resume = screen.getByLabelText("Exporter");
    await userEvent.click(resume);
    await userEvent.click(within(resume.closest("details")).getByRole("button", { name: /CSV/ }));
    await vi.waitFor(() => expect(telechargerTexte).toHaveBeenCalled());
    expect(journaliserExport).toHaveBeenCalledWith(expect.objectContaining({ format: "csv", lignes: 2 }));
    expect(journaliserExport.mock.invocationCallOrder[0]).toBeLessThan(telechargerTexte.mock.invocationCallOrder[0]);
    expect(telechargerTexte.mock.calls[0][1]).toContain("Motif de sortie");
  });
});

describe("Avocats inscrits — filtre de statut", () => {
  it("ne propose plus les statuts de sortie", async () => {
    listerMembres.mockResolvedValue({ items: [] });
    rendre(<Avocats />);
    const select = await screen.findByLabelText("Filtrer par statut");
    const libelles = within(select).getAllByRole("option").map((o) => o.textContent);
    for (const l of ["Radié", "Décédé", "Démissionnaire", "Retraité", "Cessation d'activité"]) expect(libelles).not.toContain(l);
    expect(libelles).toContain("Inscrit");
  });
});
