import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { Parametres } from "../Parametres";
import { getParametres, majParametres } from "../../api/resources";

vi.mock("../../api/resources", () => ({
  getParametres: vi.fn(),
  majParametres: vi.fn().mockResolvedValue({}),
  getNotifications: vi.fn().mockResolvedValue({ journal: [] }),
  reinitialiserDonnees: vi.fn(),
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
  getRbac: vi.fn().mockReturnValue(new Promise(() => {})),
  majRbacRole: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const cond = { ancienneteMinAns: 0, stricte: false };
const regles = {
  admissionDirecte: { cas: [{ code: "MAGISTRAT", libelle: "Magistrat", ancienneteMinAns: 5, article: "art. 32" }] },
  impayes: { delaiRappelJours: 30, delaiMiseEnDemeureJours: 15 },
  sanctions: [
    { code: "AVERTISSEMENT", libelle: "Avertissement", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
    { code: "INTERDICTION_TEMPORAIRE", libelle: "Interdiction temporaire", effet: "SUSPENSION", dureeMaxMois: 12, sursisPossible: true },
  ],
  sursisAutorise: true,
  effetRadiation: "ENREGISTREMENT",
  peineAccessoireMaxMois: 60,
  electoral: { qualites: ["AVOCAT"], statutsExclus: ["RADIE"], exigerCotisationAJour: true, honorairesElecteurs: false },
  eligibilite: { BATONNIER: { ancienneteMinAns: 8, stricte: true }, CONSEIL: cond, CONSEIL_BARREAU: cond, AUTRE: cond },
  exclurePeineAccessoire: true,
};

const rendre = () => render(<MemoryRouter><ToastProvider><Parametres /></ToastProvider></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  getParametres.mockResolvedValue({
    tarifs: {}, identite: { denomination: "Barreau", ville: "Pointe-Noire", modeDemonstration: false },
    stage: { dureeMois: 24, certificatObligatoire: false }, regles,
  });
});

describe("Parametres — règles juridiques provisoires", () => {
  it("affiche la mention C-05 dans chacun des 7 blocs (dont Quitus, T17) et envoie l'objet regles complet", async () => {
    rendre();
    await userEvent.click(await screen.findByRole("tab", { name: /Règles juridiques/ }));
    const panneau = await screen.findByRole("tabpanel");
    expect(within(panneau).getAllByText(/Les valeurs signalées « provisoire »/).length).toBe(7);

    const duree = within(panneau).getByLabelText("Durée du stage (mois)");
    await userEvent.clear(duree);
    await userEvent.type(duree, "18");
    await userEvent.click(within(panneau).getByRole("button", { name: /Enregistrer les règles/ }));

    expect(majParametres).toHaveBeenCalledTimes(1);
    const { regles: envoyees, stage } = majParametres.mock.calls[0][0];
    expect(stage).toEqual({ dureeMois: 18, certificatObligatoire: false });
    expect(Object.keys(envoyees).sort()).toEqual(Object.keys(regles).sort());
    expect(envoyees.sanctions).toHaveLength(2);
  });

  it("l'identité expose la ville et le mode démonstration, sans sélecteur de couleur", async () => {
    rendre();
    await userEvent.click(await screen.findByRole("tab", { name: /Institution/ }));
    expect(screen.getByLabelText(/Ville/)).toHaveValue("Pointe-Noire");
    await userEvent.click(screen.getByLabelText(/Mode démonstration/));
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(majParametres.mock.calls[0][0].identite).toMatchObject({ ville: "Pointe-Noire", modeDemonstration: true });
    expect(document.querySelector('input[type="color"]')).toBeNull();
  });
});
