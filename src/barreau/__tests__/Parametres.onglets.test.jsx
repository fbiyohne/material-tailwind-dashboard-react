import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/Toast";
import { Parametres } from "../pages/Parametres";
import { getParametres, majParametres } from "../api/resources";

/** T17 (M-20261011, point 7) : onglets des Paramètres réordonnés en 9 groupes, rôle Avocat affiché. */
vi.mock("../api/resources", () => ({
  getParametres: vi.fn(),
  majParametres: vi.fn().mockResolvedValue({}),
  getNotifications: vi.fn().mockResolvedValue({ journal: [], emailSimulation: true, smsSimulation: true }),
  reinitialiserDonnees: vi.fn(),
  listerMembres: vi.fn().mockResolvedValue({ items: [] }),
  testerCanal: vi.fn(),
  majRbacRole: vi.fn(),
  getRbac: vi.fn().mockResolvedValue({
    permissions: [{ cle: "membres", libelle: "Membres", description: "" }],
    actions: [{ cle: "discipline_decider", libelle: "Décision disciplinaire", description: "" }],
    rolesEditables: [{ cle: "BATONNIER", libelle: "Bâtonnier" }],
    rolesComplet: [{ cle: "SECRETAIRE_GENERAL", libelle: "Secrétaire Général" }],
    rolesLectureSeule: [{ cle: "AVOCAT", libelle: "Avocat", lectureSeule: true, mention: "Espace cloisonné" }],
    matrice: { BATONNIER: ["membres"] },
  }),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));

const cond = { ancienneteMinAns: 0, stricte: false };
const regles = {
  admissionDirecte: { cas: [] },
  impayes: { delaiRappelJours: 30, delaiMiseEnDemeureJours: 15 },
  sanctions: [],
  sursisAutorise: true,
  effetRadiation: "ENREGISTREMENT",
  peineAccessoireMaxMois: 60,
  electoral: { qualites: ["AVOCAT"], statutsExclus: [], exigerCotisationAJour: true, honorairesElecteurs: false },
  eligibilite: { BATONNIER: cond, CONSEIL: cond, CONSEIL_BARREAU: cond, AUTRE: cond },
  exclurePeineAccessoire: true,
  quitus: { validiteMois: 3 },
};

const rendre = () => render(<MemoryRouter><ToastProvider><Parametres /></ToastProvider></MemoryRouter>);
const ongletsPrincipaux = () => within(screen.getByRole("tablist", { name: "Sections des paramètres" })).getAllByRole("tab");
const ouvrir = async (nom) => userEvent.click(within(screen.getByRole("tablist", { name: "Sections des paramètres" })).getByRole("tab", { name: nom }));

beforeEach(() => {
  vi.clearAllMocks();
  getParametres.mockResolvedValue({
    tarifs: {}, identite: { denomination: "Barreau" },
    stage: { dureeMois: 24, certificatObligatoire: false }, regles,
    documents: { categoriesArchives: ["Procès-verbaux"], typesPublication: [] },
    paiement: { canauxActifs: ["MTN"] },
  });
});

describe("Paramètres — 9 onglets ordonnés (T17)", () => {
  it("affiche les 9 groupes dans l'ordre arrêté", async () => {
    rendre();
    await screen.findByDisplayValue("Barreau"); // chargement terminé
    expect(ongletsPrincipaux().map((t) => t.textContent.trim())).toEqual([
      "Barreau et identité", "Règles juridiques", "Tarifs et exercices", "Rôles et sécurité",
      "Paiements", "Notifications", "Messagerie", "Modules", "Documents",
    ]);
  });

  it("Rôles et sécurité affiche le rôle Avocat, « Espace cloisonné », avec des cases désactivées", async () => {
    rendre();
    await ouvrir(/Rôles et sécurité/);
    const ligne = (await screen.findByText("Espace cloisonné")).closest("tr");
    expect(within(ligne).getByText("Avocat")).toBeTruthy();
    const cases = within(ligne).getAllByRole("checkbox");
    expect(cases.length).toBe(2);
    cases.forEach((c) => { expect(c.disabled).toBe(true); expect(c.checked).toBe(false); });
    expect(within(ligne).queryByRole("button")).toBeNull();
  });

  it("validiteMois est éditable (1 à 24), mention provisoire, et persisté dans regles.quitus", async () => {
    rendre();
    await ouvrir(/Règles juridiques/);
    const champ = await screen.findByLabelText(/Validité du quitus/);
    expect(champ.min).toBe("1");
    expect(champ.max).toBe("24");
    await userEvent.clear(champ);
    await userEvent.type(champ, "6");
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer les règles/ }));
    expect(majParametres).toHaveBeenCalledTimes(1);
    expect(majParametres.mock.calls[0][0].regles.quitus).toEqual({ validiteMois: 6 });
    expect(screen.getByText(/règles sont provisoires/)).toBeTruthy();
  });

  it("aucune perte de fonction : chaque ancien panneau reste accessible", async () => {
    rendre();
    // Barreau et identité : Institution, Conseil, Libellés.
    expect(await screen.findByText("Identité de l'institution")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: /Conseil de l'Ordre/ }));
    expect(screen.getByText("Fonctions du Conseil de l'Ordre")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: /Libellés des statuts/ }));
    expect(screen.getByText("Statuts de membre")).toBeTruthy();
    await ouvrir(/Tarifs et exercices/);
    expect(screen.getByText("Tarifs de référence & exercices")).toBeTruthy();
    // Paiements : canaux proposés en ligne (ex-sous-onglet « Paiement & stage »), enregistrés à part.
    await ouvrir(/Paiements/);
    await userEvent.click(await screen.findByLabelText("Airtel Money"));
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer les canaux/ }));
    expect(majParametres.mock.calls.at(-1)[0]).toEqual({ paiement: { canauxActifs: ["MTN", "AIRTEL"] } });
    expect(await screen.findByLabelText("Utilisateur API")).toBeTruthy(); // passerelles (T15)
    await ouvrir(/Notifications/);
    expect(await screen.findByText("Journal des envois")).toBeTruthy();
    expect((await screen.findAllByText("Simulation")).length).toBe(2); // état SMTP et SMS de l'ancien onglet
    await ouvrir(/Messagerie/);
    expect(await screen.findByText("Messagerie interne")).toBeTruthy();
    await ouvrir(/Modules/);
    expect(screen.getByText("Modules du menu")).toBeTruthy();
    // Documents : catégories d'archives et types de publication.
    await ouvrir(/Documents/);
    expect(screen.getByText("Procès-verbaux")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Enregistrer/ }));
    expect(majParametres.mock.calls.at(-1)[0]).toEqual({ documents: { categoriesArchives: ["Procès-verbaux"], typesPublication: [] } });
    expect(screen.queryByRole("tab", { name: /Paiement & stage/ })).toBeNull();
  });
});
