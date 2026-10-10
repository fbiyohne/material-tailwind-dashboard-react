import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Elections } from "../Elections";
import { EspaceScrutins } from "../espace/EspaceScrutins";
import { CorpsElectoral } from "../CorpsElectoral";
import * as res from "../../api/resources";

// T22 — élections : bandeau expérimental (CA12), date du scrutin, libellé du décès (O9), refus motivé.
vi.mock("../../api/resources", () => ({
  listerScrutins: vi.fn().mockResolvedValue([{ id: 1, titre: "Conseil 2026", type: "CONSEIL_BARREAU", modalite: "PRESENTIEL", statut: "PREPARATION", _count: { candidats: 0 } }]),
  getScrutin: vi.fn().mockResolvedValue({ id: 1, titre: "Conseil 2026", type: "CONSEIL_BARREAU", modalite: "PRESENTIEL", statut: "PREPARATION", nbSieges: 1, dateScrutin: "2026-12-05T00:00:00.000Z", candidats: [], _count: { emargements: 0, candidats: 0 } }),
  creerScrutin: vi.fn(), ajouterCandidat: vi.fn(), supprimerCandidat: vi.fn(), ouvrirScrutin: vi.fn(), saisirVoix: vi.fn(),
  cloreScrutin: vi.fn(), publierScrutin: vi.fn(), supprimerScrutin: vi.fn(), telechargerPvScrutinPdf: vi.fn(),
  getEspaceScrutins: vi.fn().mockResolvedValue([]), voterScrutin: vi.fn(),
  getCorpsElectoral: vi.fn().mockResolvedValue({ electeurs: [], exclusCotisation: [], exclusStatut: [], exclusAutre: [] }),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const env = (ui) => <MemoryRouter><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></MemoryRouter>;
const BANDEAU = { name: /fonctionnalité expérimentale/i };

beforeEach(() => vi.clearAllMocks());

describe("Élections — prototype", () => {
  it("Elections affiche le bandeau, sans promesse de secret garanti", async () => {
    render(env(<Elections />));
    expect(await screen.findByRole("note", BANDEAU)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/secret du vote garanti/i);
  });

  it("EspaceScrutins affiche le bandeau", async () => {
    render(env(<EspaceScrutins />));
    expect(await screen.findByRole("note", BANDEAU)).toBeInTheDocument();
  });

  it("propose le type Conseil du barreau et la date du scrutin", async () => {
    render(env(<Elections />));
    await userEvent.click(await screen.findByRole("button", { name: /Nouveau scrutin/ }));
    expect(screen.getByRole("option", { name: "Conseil du barreau" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date du scrutin/)).toHaveAttribute("type", "date");
  });

  it("affiche le refus motivé d'une candidature", async () => {
    res.ajouterCandidat.mockRejectedValue(new Error("Candidature refusée : ancienneté insuffisante."));
    render(env(<Elections />));
    await userEvent.click(await screen.findByText("Conseil 2026"));
    await userEvent.type(await screen.findByPlaceholderText(/Nom du candidat/), "Me Test");
    await userEvent.click(screen.getByRole("button", { name: /Ajouter/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ancienneté insuffisante");
  });
});

describe("Corps électoral", () => {
  it("le libellé d'exclusion mentionne le décès", async () => {
    res.getCorpsElectoral.mockResolvedValue({ electeurs: [], exclusCotisation: [], exclusStatut: [{ id: 1, nom: "X", cabinet: "" }], exclusAutre: [] });
    render(env(<CorpsElectoral />));
    expect(await screen.findByText(/décédé/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Exclusions/ }));
    expect(await screen.findByText(/décès/)).toBeInTheDocument();
  });

  it("un changement de date relance la requête avec la date", async () => {
    render(env(<CorpsElectoral />));
    const champ = await screen.findByLabelText(/Situation à la date du/);
    fireEvent.change(champ, { target: { value: "2026-06-30" } });
    await waitFor(() => expect(res.getCorpsElectoral).toHaveBeenLastCalledWith(expect.anything(), "2026-06-30"));
  });

  it("signale la limite de l'historique (PO-20)", async () => {
    render(env(<CorpsElectoral />));
    expect(await screen.findByText(/sans événement enregistré/)).toBeInTheDocument();
  });
});
