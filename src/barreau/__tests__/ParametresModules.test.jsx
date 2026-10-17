import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { ParametresModules } from "../components/ParametresModules";
import { Sidebar } from "../layout/Sidebar";
import { appliquerConfig } from "../data/config";
import { majParametres } from "../api/resources";

vi.mock("../api/resources", () => ({
  majParametres: vi.fn().mockResolvedValue({}),
  getCotisations: vi.fn().mockResolvedValue([]),
  listerDossiers: vi.fn().mockResolvedValue([]),
  getMessagerieNonLus: vi.fn().mockResolvedValue({ total: 0 }),
  listerToutesPieces: vi.fn().mockResolvedValue([]),
}));
vi.mock("../api/realtime", () => ({ onRealtime: () => () => {} }));
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { nom: "Me Test", role: "ADMIN", permissions: [] }, logout: vi.fn() }),
}));
vi.mock("../routes", async (orig) => {
  const m = await orig();
  // Tout le menu est visible : on isole le masquage du RBAC.
  return { ...m, sectionsPourUser: () => m.default };
});

beforeEach(() => { vi.clearAllMocks(); appliquerConfig({ modules: { masques: [] } }); });

describe("Sidebar — modules masqués", () => {
  it("retire un chemin masqué mais garde / et /parametres même s'ils sont listés", () => {
    appliquerConfig({ modules: { masques: ["/cabinets", "/", "/parametres"] } });
    render(<MemoryRouter><Sidebar open onClose={() => {}} /></MemoryRouter>);
    expect(screen.queryByText("Personnes morales")).toBeNull();
    expect(screen.getByRole("link", { name: /Tableau de bord/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Paramètres/ })).toBeTruthy();
  });
});

describe("ParametresModules", () => {
  it("les modules obligatoires ont un interrupteur désactivé", () => {
    render(<ToastProvider><ParametresModules /></ToastProvider>);
    for (const nom of ["Tableau de bord", "Paramètres", "Journal d'audit", "Tableau de l'Ordre", "Discipline"]) {
      expect(screen.getByLabelText(`Afficher ${nom} dans le menu`).disabled).toBe(true);
    }
    expect(screen.getAllByText(/non désactivable/).length).toBe(5);
    expect(screen.getByLabelText("Afficher Archives dans le menu").disabled).toBe(false);
  });

  it("enregistre la liste des modules masqués", async () => {
    render(<ToastProvider><ParametresModules /></ToastProvider>);
    await userEvent.click(screen.getByLabelText("Afficher Archives dans le menu"));
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer les modules/ }));
    expect(majParametres).toHaveBeenCalledWith({ modules: { masques: ["/archives"] } });
  });
});
