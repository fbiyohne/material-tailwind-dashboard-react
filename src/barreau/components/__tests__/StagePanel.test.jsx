import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { StagePanel } from "../StagePanel";
import { listerRapportsStage, validerStage, getParametres } from "../../api/resources";

let user = { role: "BATONNIER", permissions: ["stage_valider"] };
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("../../api/resources", () => ({
  listerRapportsStage: vi.fn(), ajouterRapportStage: vi.fn(), supprimerRapportStage: vi.fn(),
  validerStage: vi.fn(), getParametres: vi.fn(),
}));

const membre = { id: 5, nom: "OKO Marie", qualite: "stagiaire", statut: "stagiaire", stage: { dateServment: "2024-01-10", dureeMois: 24, maitreStage: "Me X" } };
const rendre = () => render(<ToastProvider><ConfirmProvider><StagePanel membre={membre} onChange={() => {}} /></ConfirmProvider></ToastProvider>);
const BOUTON = { name: "Valider la fin de stage" };

beforeEach(() => {
  vi.clearAllMocks();
  user = { role: "BATONNIER", permissions: ["stage_valider"] };
  listerRapportsStage.mockResolvedValue([]);
  getParametres.mockResolvedValue({ stage: { dureeMois: 24, certificatObligatoire: false } });
});

describe("StagePanel — fin de stage", () => {
  it("ouvre le formulaire : dates, certificat, organe et mention provisoire", async () => {
    rendre();
    await userEvent.click(await screen.findByRole("button", BOUTON));
    expect(screen.getByLabelText(/Date de la décision/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de la demande/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date du certificat/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Référence du certificat/)).toBeInTheDocument();
    expect(screen.getAllByText(/Bâtonnier national/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Provisoire, à confirmer par les textes/)).toBeInTheDocument();
  });

  it("certificat facultatif par défaut : envoie la date de décision seule", async () => {
    validerStage.mockResolvedValue({});
    rendre();
    await userEvent.click(await screen.findByRole("button", BOUTON));
    await userEvent.click(screen.getAllByRole("button", BOUTON)[1]);
    await waitFor(() => expect(validerStage).toHaveBeenCalledWith(5, { dateDecision: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it("certificat obligatoire (règle Paramètres) : bouton bloqué tant que date et référence manquent", async () => {
    getParametres.mockResolvedValue({ stage: { certificatObligatoire: true } });
    rendre();
    await userEvent.click(await screen.findByRole("button", BOUTON));
    const valider = screen.getAllByRole("button", BOUTON)[1];
    await waitFor(() => expect(valider).toBeDisabled());
    await userEvent.type(screen.getByLabelText(/Référence du certificat/), "CERT-1");
    await userEvent.type(screen.getByLabelText(/Date du certificat/), "2026-09-01");
    await waitFor(() => expect(valider).toBeEnabled());
  });

  it("sans la permission stage_valider : pas de bouton, l'organe est nommé", async () => {
    user = { role: "SECRETAIRE_GENERAL", permissions: [] };
    rendre();
    await screen.findByText(/Bâtonnier national/);
    expect(screen.queryByRole("button", BOUTON)).not.toBeInTheDocument();
  });
});
