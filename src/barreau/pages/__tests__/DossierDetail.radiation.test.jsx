import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { DossierDetail } from "../DossierDetail";
import { getDossier, getParametres, listerEvenements, radierMembre, reformerDecisionDossier } from "../../api/resources";
import { dateLocaleISO } from "../../utils/format";

// T21 : la radiation se rend exécutoire et se réforme depuis le dossier disciplinaire.
vi.mock("../../api/resources", () => ({
  getDossier: vi.fn(),
  getParametres: vi.fn(),
  listerEvenements: vi.fn(),
  radierMembre: vi.fn(),
  declarerDeces: vi.fn(),
  reformerDecisionDossier: vi.fn(),
  majDossier: vi.fn(),
  archiverDoc: vi.fn(),
  telechargerDecisionDisciplinePdf: vi.fn(),
  enregistrerDecisionDossier: vi.fn(),
}));
let utilisateur;
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: utilisateur }) }));

const SANCTIONS = [
  { code: "REPRIMANDE", libelle: "Réprimande", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
  { code: "RADIATION", libelle: "Radiation", effet: "RADIATION", dureeMaxMois: null, sursisPossible: false },
];
const regles = (effetRadiation) => ({ sursisAutorise: true, peineAccessoireMaxMois: 60, effetRadiation, sanctions: SANCTIONS });
const DOSSIER = {
  id: 3, reference: "2026-01", statut: "decision", avocatNom: "BAKALA Jean", membreId: 12, objet: "Manquement", dateSaisine: "2026-09-01", pieces: [],
  sanctionCode: "RADIATION", sanction: "Radiation", decidePar: "Conseil de discipline (art. 36, loi n° 026-92)", dateDecision: "2026-10-01", motivation: "Faits établis",
};
const BATONNIER = { role: "BATONNIER", permissions: ["discipline", "discipline_decider"] };
const EXECUTOIRE = /Rendre la radiation exécutoire/;
const REFORMATION = /Enregistrer une réformation/;

const monter = async () => {
  render(
    <MemoryRouter initialEntries={["/discipline/3"]}>
      <ToastProvider><ConfirmProvider>
        <Routes><Route path="/discipline/:id" element={<DossierDetail />} /></Routes>
      </ConfirmProvider></ToastProvider>
    </MemoryRouter>
  );
  await userEvent.click(await screen.findByRole("tab", { name: /Instruction/ }));
  await screen.findByText(/Décision enregistrée : Radiation/);
};

beforeEach(() => {
  vi.clearAllMocks();
  utilisateur = BATONNIER;
  getDossier.mockImplementation(async () => ({ ...DOSSIER })); // objet neuf à chaque lecture, comme l'API
  getParametres.mockResolvedValue({ regles: regles("EXPIRATION_RECOURS") });
  listerEvenements.mockResolvedValue([{ id: 40, type: "SANCTION", dossierId: 3, reference: "2026-01" }]);
  radierMembre.mockResolvedValue({ id: 12, statut: "radie" });
  reformerDecisionDossier.mockResolvedValue(DOSSIER);
});

describe("DossierDetail — rendre la radiation exécutoire", () => {
  it("affiche l'action au détenteur de discipline_decider en mode EXPIRATION_RECOURS", async () => {
    await monter();
    expect(await screen.findByRole("button", { name: EXECUTOIRE })).toBeInTheDocument();
    expect(screen.getByText(/non encore exécutoire/)).toBeInTheDocument();
    expect(listerEvenements).toHaveBeenCalledWith(12);
  });

  it("n'affiche aucune action sans la permission discipline_decider", async () => {
    utilisateur = { role: "SECRETAIRE_GENERAL", permissions: ["discipline"] };
    await monter();
    expect(screen.queryByRole("button", { name: EXECUTOIRE })).toBeNull();
    expect(screen.queryByRole("button", { name: REFORMATION })).toBeNull();
  });

  it("n'affiche pas l'action en mode immédiat (ENREGISTREMENT)", async () => {
    getParametres.mockResolvedValue({ regles: regles("ENREGISTREMENT") });
    listerEvenements.mockResolvedValue([{ id: 41, type: "RADIATION", dossierId: 3, dateEffet: "2026-10-01" }]);
    await monter();
    await screen.findByRole("button", { name: REFORMATION });
    expect(screen.queryByRole("button", { name: EXECUTOIRE })).toBeNull();
  });

  it("n'affiche plus l'action une fois la radiation exécutée pour ce dossier", async () => {
    listerEvenements.mockResolvedValue([{ id: 41, type: "RADIATION", dossierId: 3, dateEffet: "2026-10-05" }]);
    await monter();
    expect(await screen.findByText(/Radiation exécutée le 05\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: EXECUTOIRE })).toBeNull();
    expect(screen.getByRole("link", { name: /parcours de l'avocat/i })).toHaveAttribute("href", "/avocats/12");
  });

  it("exige la référence de la décision et la pièce", async () => {
    await monter();
    await userEvent.click(await screen.findByRole("button", { name: EXECUTOIRE }));
    const dialogue = await screen.findByRole("dialog", { name: /Rendre exécutoire la radiation de Me BAKALA Jean/ });
    expect(dialogue).toHaveTextContent("Conseil de discipline (art. 36, loi n° 026-92)"); // organe de la décision
    await userEvent.clear(screen.getByLabelText(/Référence de la décision/));
    await userEvent.click(screen.getByRole("button", { name: "Rendre exécutoire" }));
    expect(await screen.findByText("Indiquez la référence de la décision.")).toBeInTheDocument();
    expect(screen.getByText("Indiquez la pièce qui atteste l'expiration du délai de recours.")).toBeInTheDocument();
    expect(radierMembre).not.toHaveBeenCalled();
  });

  it("après confirmation, appelle radierMembre avec dossierId, référence et pièce, puis recharge", async () => {
    await monter();
    await userEvent.click(await screen.findByRole("button", { name: EXECUTOIRE }));
    expect(screen.getByLabelText(/Référence de la décision/)).toHaveValue("2026-01"); // référence de la décision enregistrée
    await userEvent.type(screen.getByLabelText(/Pièce justificative/), "Certificat de non-appel du greffe n° 88");
    await userEvent.click(screen.getByRole("button", { name: "Rendre exécutoire" }));
    await waitFor(() => expect(radierMembre).toHaveBeenCalledWith(12, {
      dateRadiation: dateLocaleISO(),
      dossierId: 3,
      motifRadiation: "2026-01 — pièce : Certificat de non-appel du greffe n° 88",
    }));
    await waitFor(() => expect(getDossier).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(listerEvenements).toHaveBeenCalledTimes(2)); // parcours relu après l'acte
  });
});

describe("DossierDetail — réformation de la décision de radiation", () => {
  it("exige la référence, confirme puis envoie la réformation", async () => {
    await monter();
    await userEvent.click(await screen.findByRole("button", { name: REFORMATION }));
    const valider = screen.getByRole("button", { name: "Enregistrer la réformation" });
    expect(valider).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText(/Voie de recours/), "APPEL");
    await userEvent.type(screen.getByLabelText(/Référence de la décision de réformation/), "CA Pointe-Noire n° 45");
    await userEvent.type(screen.getByLabelText(/^Motif/), "Radiation infirmée");
    await userEvent.click(valider);
    expect(reformerDecisionDossier).not.toHaveBeenCalled(); // confirmation d'abord
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(reformerDecisionDossier).toHaveBeenCalledWith(3, {
      voie: "APPEL", reference: "CA Pointe-Noire n° 45", dateEffet: dateLocaleISO(), motif: "Radiation infirmée",
    }));
    await waitFor(() => expect(getDossier).toHaveBeenCalledTimes(2));
  });

  it("une décision réformée n'offre plus aucune action et affiche la réformation", async () => {
    listerEvenements.mockResolvedValue([{ id: 42, type: "REFORMATION", dossierId: 3, reference: "CA PN n° 45", dateEffet: "2026-10-08" }]);
    await monter();
    expect(await screen.findByText(/Décision réformée le 08\/10\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: EXECUTOIRE })).toBeNull();
    expect(screen.queryByRole("button", { name: REFORMATION })).toBeNull();
  });
});
