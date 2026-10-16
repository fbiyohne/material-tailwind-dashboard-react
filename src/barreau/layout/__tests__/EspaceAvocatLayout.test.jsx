import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { EspaceAvocatLayout } from "../EspaceAvocatLayout";
import { appliquerConfig } from "../../data/config";

// T13 (M-20261016) : le menu de l'espace avocat suit les modules masqués dans Paramètres.
vi.mock("../../api/resources", () => ({
  getEspaceMessagerieNonLus: vi.fn().mockResolvedValue({ total: 0 }),
  getEspaceNotifications: vi.fn().mockResolvedValue({ items: [] }),
  marquerEspaceNotifLue: vi.fn(), marquerToutesEspaceNotifsLues: vi.fn(),
}));
vi.mock("../../api/realtime", () => ({ onRealtime: () => () => {} }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ logout: vi.fn() }) }));
// Pages remplacées par des bouchons : seul le menu est testé ici.
vi.mock("../../pages/espace/MaSituation", () => ({ default: () => null }));

const rendre = () => render(<MemoryRouter initialEntries={["/"]}><EspaceAvocatLayout /></MemoryRouter>);

afterEach(() => appliquerConfig({ modules: { masques: [] } }));

describe("EspaceAvocatLayout — modules masqués", () => {
  it("un module masqué disparaît du menu desktop et mobile ; un module obligatoire reste", async () => {
    appliquerConfig({ modules: { masques: ["/annuaire", "/discipline"] } });
    rendre();
    const desktop = screen.getAllByRole("navigation")[0];
    expect(within(desktop).queryByRole("link", { name: "Annuaire" })).toBeNull();
    // « /discipline » figure dans MODULES_OBLIGATOIRES : il ne peut pas être masqué.
    expect(within(desktop).getByRole("link", { name: "Discipline" })).toBeInTheDocument();
    expect(within(desktop).getByRole("link", { name: "Timbres" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Menu de navigation" }));
    const mobile = screen.getAllByRole("navigation")[1];
    expect(within(mobile).queryByRole("link", { name: "Annuaire" })).toBeNull();
    expect(within(mobile).getByRole("link", { name: "Discipline" })).toBeInTheDocument();
    expect(within(mobile).getByRole("link", { name: "Mon compte" })).toBeInTheDocument();
  });

  it("sans module masqué, tout le menu est affiché", () => {
    rendre();
    const desktop = screen.getAllByRole("navigation")[0];
    expect(within(desktop).getByRole("link", { name: "Annuaire" })).toBeInTheDocument();
    expect(within(desktop).getAllByRole("link")).toHaveLength(10);
  });
});
