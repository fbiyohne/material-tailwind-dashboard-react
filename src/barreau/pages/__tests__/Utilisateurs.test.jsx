import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Utilisateurs } from "../Utilisateurs";
import { listerUsers, getRbac } from "../../api/resources";

// R1-1 : miroir front de users.ts — l'ADMIN ne prend pas la main sur un compte qui accède au contenu.
const auth = { user: { id: 1, role: "ADMIN" } };
vi.mock("../../api/resources", () => ({
  listerUsers: vi.fn(),
  getRbac: vi.fn(),
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
  getRbac.mockResolvedValue({ matrice: { BATONNIER: ["messagerie"], SECRETAIRE_ADJOINT: ["messagerie"], TRESORIERE: ["finances", "messagerie"], ACCUEIL: ["membres"], CONSULTATION: ["membres"] } });
});

describe("Utilisateurs — secret professionnel (ADMIN)", () => {
  it("sur un compte SG ou Trésorière, l'ADMIN n'a que Désactiver ; sur Consultation, toutes les actions", async () => {
    rendre();
    for (const nom of ["Jean Secrétariat", "Trésorière Kalina"]) {
      const l = within(await ligne(nom));
      await screen.findAllByRole("button", { name: "Désactiver" });
      expect(l.queryByRole("button", { name: /Mot de passe/ })).toBeNull();
      expect(l.queryByRole("button", { name: /Modifier/ })).toBeNull();
      expect(l.queryByRole("button", { name: /Supprimer/ })).toBeNull();
      expect(l.getByRole("combobox")).toBeDisabled();
      expect(l.getByRole("button", { name: "Désactiver" })).toBeEnabled();
    }
    const c = within(await ligne("Agent Consultation"));
    expect(c.getByRole("button", { name: /Mot de passe/ })).toBeInTheDocument();
    // Promotion vers un rôle ayant accès au contenu : non proposée.
    const options = within(c.getByRole("combobox")).getAllByRole("option").map((o) => o.value);
    expect(options).not.toContain("TRESORIERE");
    expect(options).not.toContain("SECRETAIRE_GENERAL");
    expect(options).toContain("ACCUEIL");
  });

  it("création par l'ADMIN : seul le premier Bâtonnier (aucun compte) est proposé parmi les rôles habilités", async () => {
    rendre();
    await ligne("Agent Consultation");
    await userEvent.click(screen.getByRole("button", { name: /Nouveau compte/ }));
    const select = within(screen.getByRole("dialog")).getByRole("combobox");
    const options = within(select).getAllByRole("option").map((o) => o.value);
    expect(options).toEqual(["BATONNIER", "ADMIN", "CONSULTATION", "ACCUEIL"]);
    expect(select).toHaveValue("BATONNIER");
  });

  it("le SG garde toutes les actions sur les comptes métier", async () => {
    auth.user = { id: 2, role: "SECRETAIRE_GENERAL" };
    rendre();
    const l = within(await ligne("Trésorière Kalina"));
    expect(l.getByRole("button", { name: /Mot de passe/ })).toBeInTheDocument();
    expect(l.getByRole("combobox")).toBeEnabled();
    expect(getRbac).not.toHaveBeenCalled();
  });
});
