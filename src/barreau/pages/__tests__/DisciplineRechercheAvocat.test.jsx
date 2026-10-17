import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { listerMembres } from "../../api/resources";
import { OuvrirDossierModal } from "../Discipline";

vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));
vi.mock("../../api/resources", () => ({
  // Le serveur plafonne une page à 200 membres : sans recherche, un avocat au-delà est inaccessible.
  listerMembres: vi.fn(async (p = {}) => ({
    items: p.q
      ? [{ id: 900, nom: "SOLANDRE Bruno", qualite: "avocat" }]
      : [{ id: 1, nom: "ABIRA Armel", qualite: "avocat" }],
  })),
  listerDossiers: vi.fn(), ouvrirDossier: vi.fn(), supprimerDossier: vi.fn(), journalDiscipline: vi.fn(),
}));

// Parcours 5 (recette T29) : un avocat hors des 200 premiers de la liste doit pouvoir être mis en cause.
describe("Ouverture d'un dossier : recherche de l'avocat mis en cause", () => {
  it("interroge le serveur avec le texte saisi et sélectionne le premier résultat", async () => {
    render(<MemoryRouter><ToastProvider><ConfirmProvider><OuvrirDossierModal open onClose={() => {}} /></ConfirmProvider></ToastProvider></MemoryRouter>);
    await screen.findByRole("option", { name: "Me ABIRA Armel" });
    fireEvent.change(screen.getByLabelText(/Rechercher l.avocat/), { target: { value: "SOLANDRE" } });
    await screen.findByRole("option", { name: "Me SOLANDRE Bruno" });
    expect(listerMembres).toHaveBeenLastCalledWith({ q: "SOLANDRE" });
    await waitFor(() => expect(screen.getByLabelText("Avocat mis en cause")).toHaveValue("900"));
  });
});
