import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Utilisateurs } from "../Utilisateurs";
import { listerUsers, listerDemandesAcces } from "../../api/resources";

// L'ADMIN a droit à tout (décision du 16/10/2026) ; seule l'anti-escalade d'un non-ADMIN subsiste.
const auth = { user: { id: 1, role: "ADMIN" } };
vi.mock("../../api/resources", () => ({
  listerUsers: vi.fn(),
  creerUser: vi.fn(), majUser: vi.fn(), resetPasswordUser: vi.fn(), supprimerUser: vi.fn(),
  listerDemandesAcces: vi.fn().mockResolvedValue([]),
  approuverDemandeAcces: vi.fn(), approuverDemandeEspace: vi.fn(), refuserDemandeAcces: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => auth }));

const users = [
  { id: 1, nom: "Admin Technique", email: "a@x.cg", role: "ADMIN", actif: true },
  { id: 2, nom: "Jean Secrétariat", email: "sg@x.cg", role: "SECRETAIRE_GENERAL", actif: true },
  { id: 3, nom: "Trésorière Kalina", email: "t@x.cg", role: "TRESORIERE", actif: true },
  { id: 4, nom: "Agent Consultation", email: "c@x.cg", role: "CONSULTATION", actif: true },
];
const ligne = async (nom) => (await screen.findByText(nom)).closest("tr");
const rendre = () => render(<MemoryRouter><ToastProvider><ConfirmProvider><Utilisateurs /></ConfirmProvider></ToastProvider></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1, role: "ADMIN" };
  listerUsers.mockResolvedValue(users);
});

const TOUS = ["SECRETAIRE_GENERAL", "BATONNIER", "TRESORIERE", "ADMIN", "SECRETAIRE_ADJOINT", "CONSULTATION", "ACCUEIL"];

describe("Utilisateurs — l'ADMIN a droit à tout", () => {
  it("sur un compte SG ou Trésorière, l'ADMIN a toutes les actions et toutes les promotions", async () => {
    rendre();
    for (const nom of ["Jean Secrétariat", "Trésorière Kalina"]) {
      const l = within(await ligne(nom));
      expect(l.getByRole("button", { name: /Mot de passe/ })).toBeInTheDocument();
      expect(l.getByRole("button", { name: /Modifier/ })).toBeInTheDocument();
      expect(l.getByRole("button", { name: /Supprimer/ })).toBeInTheDocument();
      expect(l.getByRole("combobox")).toBeEnabled();
      expect(l.getByRole("button", { name: "Désactiver" })).toBeEnabled();
      expect(within(l.getByRole("combobox")).getAllByRole("option").map((o) => o.value)).toEqual(TOUS);
    }
  });

  it("création par l'ADMIN : tous les rôles sont proposés, SG par défaut", async () => {
    rendre();
    await ligne("Agent Consultation");
    await userEvent.click(screen.getByRole("button", { name: /Nouveau compte/ }));
    const select = within(screen.getByRole("dialog")).getByRole("combobox");
    expect(within(select).getAllByRole("option").map((o) => o.value)).toEqual(TOUS);
    expect(select).toHaveValue("SECRETAIRE_GENERAL");
  });

  it("demande d'accès traitée par l'ADMIN : l'« Accès espace avocat » est proposé", async () => {
    listerDemandesAcces.mockResolvedValueOnce([{ id: 9, nom: "Me Demandeur", email: "dem@x.cg", createdAt: "2026-10-16" }]);
    rendre();
    await userEvent.click(await screen.findByRole("button", { name: /Provisionner/ }));
    const dlg = within(screen.getByRole("dialog"));
    expect(dlg.getByRole("button", { name: "Accès espace avocat" })).toBeInTheDocument();
  });

  it("le SG garde toutes les actions sur les comptes métier mais ne voit pas le rôle ADMIN", async () => {
    auth.user = { id: 2, role: "SECRETAIRE_GENERAL" };
    rendre();
    const l = within(await ligne("Trésorière Kalina"));
    expect(l.getByRole("button", { name: /Mot de passe/ })).toBeInTheDocument();
    expect(l.getByRole("combobox")).toBeEnabled();
    const options = within(l.getByRole("combobox")).getAllByRole("option").map((o) => o.value);
    expect(options).not.toContain("ADMIN");
    await userEvent.click(screen.getByRole("button", { name: /Nouveau compte/ }));
    const select = within(screen.getByRole("dialog")).getByRole("combobox");
    expect(within(select).getAllByRole("option").map((o) => o.value)).not.toContain("ADMIN");
  });
});
