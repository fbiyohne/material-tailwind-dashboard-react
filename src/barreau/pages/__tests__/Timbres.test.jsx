import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Timbres } from "../Timbres";
import { MesTimbres } from "../espace/MesTimbres";
import { VerificationPublique } from "../VerificationPublique";

// T16 (CA12) — bandeau « Expérimental » sur les 3 écrans du timbre ; vérification publique anonyme (R-64, C-12).
vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
  listerTimbres: vi.fn().mockResolvedValue([]),
  creerTimbre: vi.fn(),
  annulerTimbre: vi.fn(),
  getEspaceTimbres: vi.fn().mockResolvedValue({ montant: 15000, timbres: [] }),
  creerEspaceTimbre: vi.fn(),
  statsTimbres: vi.fn().mockResolvedValue({ annee: 2026, lignes: [{ mois: 1, canal: "MTN", source: "externe", nombre: 2, montant: 30000 }] }),
  importerTimbresExternes: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const enveloppe = (ui) => <MemoryRouter><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></MemoryRouter>;
const BANDEAU = { name: /fonctionnalité expérimentale/i };

beforeEach(() => vi.clearAllMocks());

describe("Timbre autonome — prototype", () => {
  it("Timbres affiche le bandeau et un onglet Statistiques ventilé par mois et canal", async () => {
    render(enveloppe(<Timbres />));
    expect(await screen.findByRole("note", BANDEAU)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Statistiques/ }));
    expect(await screen.findByText("MTN")).toBeInTheDocument();
    expect(screen.getByText("Externe")).toBeInTheDocument();
  });

  it("MesTimbres affiche le bandeau", async () => {
    render(enveloppe(<MesTimbres />));
    expect(await screen.findByRole("note", BANDEAU)).toBeInTheDocument();
  });

  it("VerificationPublique d'un timbre affiche le bandeau, sans bénéficiaire ni montant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valide: true, type: "timbre", numero: "45", date: "2026-10-01", affaire: "A" }) }));
    render(<VerificationPublique type="timbre" numero="ABC" />);
    expect(await screen.findByText("Document authentique")).toBeInTheDocument();
    expect(screen.getByRole("note", BANDEAU)).toBeInTheDocument();
    expect(screen.queryByText("Bénéficiaire")).toBeNull();
    expect(screen.queryByText("Affaire")).toBeNull();
    expect(screen.queryByText("Montant")).toBeNull();
    vi.unstubAllGlobals();
  });
});

// R2-10 — texte du bandeau propre au timbre (pas la formule du scrutin).
import { BandeauExperimental, TEXTE_EXPERIMENTAL_TIMBRE } from "../../components/BandeauExperimental";
describe("R2-10 bandeau timbre", () => {
  it("dit « aucun timbre émis » et ne mentionne pas le scrutin", () => {
    const { getByRole } = render(<BandeauExperimental variante="timbre" />);
    const t = getByRole("note").textContent.replace(/\s+/g, " ").trim();
    expect(t).toBe(TEXTE_EXPERIMENTAL_TIMBRE);
    expect(t).not.toMatch(/scrutin/i);
  });
});
