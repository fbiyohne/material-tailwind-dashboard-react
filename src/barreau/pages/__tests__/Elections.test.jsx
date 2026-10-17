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
const auth = vi.hoisted(() => ({ role: "SECRETAIRE_GENERAL" }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: auth.role } }) }));

const env = (ui) => <MemoryRouter><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></MemoryRouter>;
const BANDEAU = { name: /fonctionnalité expérimentale/i };

beforeEach(() => { vi.clearAllMocks(); auth.role = "SECRETAIRE_GENERAL"; });

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

describe("Élections — suppression d'un scrutin", () => {
  const TITRE = "Conseil 2026";
  const monter = (statut) => {
    const base = { id: 1, titre: TITRE, type: "CONSEIL_BARREAU", modalite: "PRESENTIEL", statut };
    res.listerScrutins.mockResolvedValue([{ ...base, _count: { candidats: 0 } }]);
    res.getScrutin.mockResolvedValue({ ...base, nbSieges: 1, candidats: [], _count: { emargements: 0, candidats: 0 } });
  };
  const ouvrir = async (statut) => {
    monter(statut);
    render(env(<Elections />));
    await userEvent.click(await screen.findByText(TITRE));
  };
  const BTN = { name: /Supprimer le scrutin/ };

  it.each(["PREPARATION", "CLOS", "PUBLIE"])("propose la suppression d'un scrutin %s", async (statut) => {
    await ouvrir(statut);
    expect(await screen.findByRole("button", BTN)).toBeInTheDocument();
  });

  it("ne propose pas la suppression d'un scrutin ouvert", async () => {
    await ouvrir("OUVERT");
    await screen.findByRole("button", { name: /Clôturer/ });
    expect(screen.queryByRole("button", BTN)).toBeNull();
  });

  it("ne propose pas la suppression sans droit de gestion", async () => {
    auth.role = "TRESORIER";
    await ouvrir("CLOS");
    await screen.findByText(/0 votant/);
    expect(screen.queryByRole("button", BTN)).toBeNull();
  });

  it.each(["CLOS", "PUBLIE"])("scrutin %s : confirmation par saisie exacte de l'intitulé", async (statut) => {
    await ouvrir(statut);
    await userEvent.click(await screen.findByRole("button", BTN));
    const dialogue = await screen.findByRole("dialog");
    expect(dialogue).toHaveTextContent(/définitive/);
    expect(dialogue).toHaveTextContent(/composition du Conseil/);
    expect(dialogue).toHaveTextContent(/procès-verbaux déjà archivés/);
    const confirmer = screen.getByRole("button", { name: "Supprimer définitivement" });
    expect(confirmer).toBeDisabled();
    await userEvent.type(dialogue.querySelector("input"), "Conseil 202");
    expect(confirmer).toBeDisabled();
    await userEvent.type(dialogue.querySelector("input"), "6");
    expect(confirmer).toBeEnabled();
  });

  it("après confirmation : un seul appel, toast, liste et détail vidés", async () => {
    res.supprimerScrutin.mockResolvedValue();
    await ouvrir("PUBLIE");
    await userEvent.click(await screen.findByRole("button", BTN));
    const dialogue = await screen.findByRole("dialog");
    await userEvent.type(dialogue.querySelector("input"), TITRE);
    res.listerScrutins.mockResolvedValue([]);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByText("Scrutin supprimé.")).toBeInTheDocument();
    expect(res.supprimerScrutin).toHaveBeenCalledTimes(1);
    expect(res.supprimerScrutin).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/Sélectionnez un scrutin/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(TITRE)).toBeNull());
  });

  it("affiche le message du serveur si la suppression échoue", async () => {
    res.supprimerScrutin.mockRejectedValue(new Error("Impossible de supprimer un scrutin ouvert."));
    await ouvrir("CLOS");
    await userEvent.click(await screen.findByRole("button", BTN));
    await userEvent.type((await screen.findByRole("dialog")).querySelector("input"), TITRE);
    await userEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    expect(await screen.findByText("Impossible de supprimer un scrutin ouvert.")).toBeInTheDocument();
    expect(screen.getByText(/0 votant/)).toBeInTheDocument();
  });

  it("scrutin en préparation : confirmation simple, sans saisie", async () => {
    res.supprimerScrutin.mockResolvedValue();
    await ouvrir("PREPARATION");
    await userEvent.click(await screen.findByRole("button", BTN));
    const dialogue = await screen.findByRole("dialog");
    expect(dialogue.querySelector("input")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(res.supprimerScrutin).toHaveBeenCalledWith(1));
  });
});
