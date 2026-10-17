import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { PiecesDossier } from "../PiecesDossier";
import { listerPieces } from "../../api/resources";

vi.mock("../../api/resources", () => ({
  listerPieces: vi.fn(), televerserPiece: vi.fn(), verifierPiece: vi.fn(), rejeterPiece: vi.fn(), supprimerPiece: vi.fn(), voirPiece: vi.fn(),
}));

describe("PiecesDossier — bouton Voir", () => {
  it("est rendu sans condition de rôle (l'ADMIN y a droit, accès tracé côté serveur)", async () => {
    listerPieces.mockResolvedValue([{ id: 3, type: "IDENTITE", nomFichier: "cni.pdf", taille: 100, statut: "A_VERIFIER", createdAt: "2026-10-01T10:00:00Z" }]);
    render(<ToastProvider><ConfirmProvider><PiecesDossier membreId={1} qualite="AVOCAT" peutGerer /></ConfirmProvider></ToastProvider>);
    expect(await screen.findByRole("button", { name: /Voir/ })).toBeInTheDocument();
  });
});
