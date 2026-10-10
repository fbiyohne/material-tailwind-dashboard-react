import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Pieces } from "../Pieces";
import { listerToutesPieces, rejeterPiece } from "../../api/resources";

vi.mock("../../api/resources", () => ({
  listerToutesPieces: vi.fn(),
  rejeterPiece: vi.fn().mockResolvedValue({}),
  verifierPiece: vi.fn(),
  supprimerPiece: vi.fn(),
  voirPiece: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const piece = { id: 7, type: "IDENTITE", nomFichier: "cni.pdf", taille: 100, statut: "A_VERIFIER", createdAt: "2026-10-01T10:00:00Z", membre: { nom: "BAKALA Jean", num: 1, qualite: "AVOCAT" } };

beforeEach(() => {
  vi.clearAllMocks();
  listerToutesPieces.mockResolvedValue([piece]);
});

describe("Pieces — rejet motivé", () => {
  it("le bouton Rejeter de la confirmation reste désactivé tant que le motif est vide, puis envoie le motif", async () => {
    render(<MemoryRouter><ToastProvider><ConfirmProvider><Pieces /></ConfirmProvider></ToastProvider></MemoryRouter>);
    await userEvent.click(await screen.findByRole("button", { name: /Rejeter/ }));
    const valider = screen.getByRole("button", { name: "Rejeter la pièce" });
    expect(valider).toBeDisabled();
    const champ = screen.getByLabelText(/Motif/);
    await userEvent.type(champ, "ab");
    expect(valider).toBeDisabled();
    await userEvent.type(champ, "c lisible");
    expect(valider).toBeEnabled();
    await userEvent.click(valider);
    expect(rejeterPiece).toHaveBeenCalledWith(7, "abc lisible");
  });
});
