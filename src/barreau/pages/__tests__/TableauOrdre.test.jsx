import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { TableauOrdre } from "../TableauOrdre";
import { getTableau } from "../../api/resources";

// T17 — le tableau se recharge au signal temps réel « tableau » et affiche sa date de mise à jour.
let handler = null;
vi.mock("../../api/realtime", () => ({ onRealtime: (h) => { handler = h; return () => { handler = null; }; } }));
vi.mock("../../api/resources", () => ({
  getTableau: vi.fn(),
  telechargerTableauPdf: vi.fn(),
  publierTableau: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const tableau = (nom) => ({ total: 1, miseAJour: "2026-10-09T10:00:00.000Z", sections: [{ qualite: "AVOCAT", membres: [{ id: 1, rang: 1, nom, statut: "INSCRIT" }] }] });

beforeEach(() => { vi.clearAllMocks(); handler = null; });

describe("TableauOrdre temps réel", () => {
  it("recharge à la réception d'un message « tableau » (et ignore les autres) et affiche la date", async () => {
    getTableau.mockResolvedValueOnce(tableau("ALPHA")).mockResolvedValue(tableau("BETA"));
    render(<MemoryRouter><ToastProvider><ConfirmProvider><TableauOrdre /></ConfirmProvider></ToastProvider></MemoryRouter>);
    expect(await screen.findByText(/Me ALPHA/)).toBeInTheDocument();
    expect(screen.getByText(/Mis à jour le/)).toBeInTheDocument();
    act(() => handler({ type: "messagerie" }));
    expect(getTableau).toHaveBeenCalledTimes(1);
    act(() => handler({ type: "tableau" }));
    await waitFor(() => expect(screen.getByText(/Me BETA/)).toBeInTheDocument());
    expect(getTableau).toHaveBeenCalledTimes(2);
  });
});
