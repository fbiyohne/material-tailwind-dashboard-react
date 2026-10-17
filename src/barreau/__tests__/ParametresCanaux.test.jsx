import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../components/Toast";
import { PanneauPaiements, PanneauNotifications, PanneauMessagerie } from "../components/ParametresCanaux";
import { getParametres, majParametres, testerCanal } from "../api/resources";

vi.mock("../api/resources", () => ({
  getParametres: vi.fn(),
  majParametres: vi.fn(),
  testerCanal: vi.fn(),
  getNotifications: vi.fn().mockResolvedValue({ journal: [] }),
}));

const PARAMS = {
  passerelles: { mode: "TEST", mtn: { actif: true, apiUser: "u1", cleSecrete: "••••1234" }, airtel: {}, agregateur: {} },
  smtp: { host: "mailhog", port: 1025, pass: "••••abcd" },
  notifications: { sms: { actif: false } },
  messagerie: { interneActive: true, piecesJointes: true, pieceMaxMo: 5, relaisEmail: true, relaisSms: false },
};
const monter = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

describe("Panneaux de canaux des Paramètres", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getParametres.mockResolvedValue(structuredClone(PARAMS));
    majParametres.mockResolvedValue({});
  });

  it("Paiements : mode production non sélectionnable, bandeau CL-PAIEMENTS présent", async () => {
    monter(<PanneauPaiements />);
    const mode = await screen.findByLabelText("Mode");
    expect(mode).toBeDisabled();
    expect(within(mode).queryByRole("option", { name: /production/i })).toBeNull();
    expect(screen.getByText(/Mode test\. Aucun paiement réel/)).toBeInTheDocument();
  });

  it("un secret masqué non modifié n'est pas renvoyé dans le PUT ; un secret saisi l'est", async () => {
    const u = userEvent.setup();
    monter(<PanneauPaiements />);
    const user = await screen.findByLabelText("Utilisateur API");
    await u.type(user, "x");
    await u.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(majParametres).toHaveBeenCalledTimes(1));
    const patch = majParametres.mock.calls[0][0];
    expect(patch.passerelles.mtn.apiUser).toBe("u1x");
    expect(patch.passerelles.mtn).not.toHaveProperty("cleSecrete");
    expect(JSON.stringify(patch)).not.toContain("••••");

    await screen.findByLabelText("Utilisateur API");
    const cle = screen.getByLabelText("Clé secrète", { selector: "#mtn-sec" });
    expect(cle).toHaveAttribute("type", "password");
    await u.clear(cle);
    await u.type(cle, "nouveau-secret");
    await u.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(majParametres).toHaveBeenCalledTimes(2));
    expect(majParametres.mock.calls[1][0].passerelles.mtn.cleSecrete).toBe("nouveau-secret");
  });

  it("Tester la connexion appelle /parametres/tester/:canal et affiche le message", async () => {
    testerCanal.mockResolvedValue({ ok: true, simulation: true, message: "simulation : configuration complète" });
    const u = userEvent.setup();
    monter(<PanneauPaiements />);
    await screen.findByLabelText("Utilisateur API");
    await u.click(screen.getAllByRole("button", { name: /Tester la connexion/ })[0]);
    expect(testerCanal).toHaveBeenCalledWith("mtn");
    expect(await screen.findByText("simulation : configuration complète")).toBeInTheDocument();
  });

  it("Notifications : le test SMTP affiche l'échec renvoyé, le mot de passe est masqué", async () => {
    testerCanal.mockResolvedValue({ ok: false, message: "Échec de la connexion SMTP (ECONNREFUSED)." });
    const u = userEvent.setup();
    monter(<PanneauNotifications />);
    const pass = await screen.findByLabelText("Mot de passe");
    expect(pass).toHaveAttribute("type", "password");
    await u.click(screen.getAllByRole("button", { name: /Tester la connexion/ })[0]);
    expect(testerCanal).toHaveBeenCalledWith("smtp");
    expect(await screen.findByText(/ECONNREFUSED/)).toBeInTheDocument();
  });

  it("Messagerie : la taille est plafonnée à 5 Mo dans le PUT", async () => {
    const u = userEvent.setup();
    monter(<PanneauMessagerie />);
    const max = await screen.findByLabelText(/Taille maximale/);
    await u.clear(max);
    await u.type(max, "9");
    await u.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(majParametres).toHaveBeenCalled());
    expect(majParametres.mock.calls[0][0].messagerie.pieceMaxMo).toBe(5);
  });

  it("état d'erreur au chargement", async () => {
    getParametres.mockRejectedValue(new Error("x"));
    monter(<PanneauMessagerie />);
    expect(await screen.findByText(/n'ont pas pu être chargés/)).toBeInTheDocument();
  });
});
