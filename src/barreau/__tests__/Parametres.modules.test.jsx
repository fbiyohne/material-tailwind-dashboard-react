import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { Parametres } from "../pages/Parametres";

vi.mock("../api/resources", () => ({
  getParametres: vi.fn().mockResolvedValue({}),
  majParametres: vi.fn().mockResolvedValue({}),
  getNotifications: vi.fn().mockResolvedValue({ journal: [] }),
  reinitialiserDonnees: vi.fn(),
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
}));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { nom: "Me Test", role: "ADMIN", permissions: ["parametres"] } }),
}));

describe("Paramètres — onglet Modules", () => {
  it("l'onglet « Modules » affiche le panneau de masquage du menu", async () => {
    render(<MemoryRouter><ToastProvider><Parametres /></ToastProvider></MemoryRouter>);
    await userEvent.click(screen.getByRole("tab", { name: /Modules/ }));
    expect(screen.getByText("Modules du menu")).toBeTruthy();
    expect(screen.getByLabelText("Afficher Discipline dans le menu").disabled).toBe(true);
    // Toute la ligne est cliquable (cible tactile) : un clic sur le libellé bascule l'interrupteur.
    await userEvent.click(screen.getByText("Archives"));
    expect(screen.getByLabelText("Afficher Archives dans le menu").checked).toBe(false);
  });
});
