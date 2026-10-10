import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { DossierDetail } from "../DossierDetail";
import { getDossier, getParametres, enregistrerDecisionDossier } from "../../api/resources";

vi.mock("../../api/resources", () => ({
  getDossier: vi.fn(),
  getParametres: vi.fn(),
  majDossier: vi.fn(),
  archiverDoc: vi.fn(),
  telechargerDecisionDisciplinePdf: vi.fn(),
  enregistrerDecisionDossier: vi.fn().mockResolvedValue({}),
}));
let utilisateur;
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: utilisateur }) }));

const REGLES = {
  sursisAutorise: true,
  peineAccessoireMaxMois: 60,
  sanctions: [
    { code: "AVERTISSEMENT", libelle: "Avertissement", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
    { code: "REPRIMANDE", libelle: "Réprimande", effet: "AUCUN", dureeMaxMois: null, sursisPossible: false },
    { code: "INTERDICTION_TEMPORAIRE", libelle: "Interdiction temporaire", effet: "SUSPENSION", dureeMaxMois: 12, sursisPossible: true },
    { code: "RADIATION", libelle: "Radiation", effet: "RADIATION", dureeMaxMois: null, sursisPossible: false },
  ],
};
const dossier = { id: 3, reference: "2026-01", statut: "instruction", avocatNom: "BAKALA Jean", objet: "Manquement", dateSaisine: "2026-09-01", pieces: [] };

const monter = () => render(
  <MemoryRouter initialEntries={["/discipline/3"]}>
    <ToastProvider><ConfirmProvider>
      <Routes><Route path="/discipline/:id" element={<DossierDetail />} /></Routes>
    </ConfirmProvider></ToastProvider>
  </MemoryRouter>
);
const ouvrirOnglet = async () => userEvent.click(await screen.findByRole("tab", { name: /Instruction/ }));

beforeEach(() => {
  vi.clearAllMocks();
  getDossier.mockResolvedValue(dossier);
  getParametres.mockResolvedValue({ regles: REGLES });
});

describe("DossierDetail — décision structurée", () => {
  it("masque le formulaire de décision au secrétaire général", async () => {
    utilisateur = { role: "SECRETAIRE_GENERAL", permissions: ["discipline"] };
    monter();
    await ouvrirOnglet();
    expect(screen.getByText(/réservé au bâtonnier/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer la décision" })).toBeNull();
    expect(screen.getByLabelText(/Origine de la saisine/)).toBeInTheDocument(); // l'instruction reste ouverte au SG
  });

  it("affiche au bâtonnier le catalogue de l'art. 36, le sursis avec la mention provisoire, et envoie la décision", async () => {
    utilisateur = { role: "BATONNIER", permissions: ["discipline", "discipline_decider"] };
    monter();
    await ouvrirOnglet();
    const choix = await screen.findByLabelText(/Peine \(art\. 36\)/);
    const libelles = within(choix).getAllByRole("option").map((o) => o.textContent);
    expect(libelles).toEqual(["— Choisir —", "Avertissement", "Réprimande", "Interdiction temporaire", "Radiation"]);

    await userEvent.selectOptions(choix, "INTERDICTION_TEMPORAIRE");
    await userEvent.type(screen.getByLabelText(/Durée \(mois\)/), "6");
    await userEvent.click(screen.getByLabelText(/Avec sursis/));
    expect(screen.getByText(/Le sursis n'est pas prévu par la loi/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Motivation/), "Manquement établi à l'audience");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la décision" }));
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect(enregistrerDecisionDossier).toHaveBeenCalledWith(3, expect.objectContaining({ sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 6, sursis: true }));
  });

  it("affiche le bandeau « décision enregistrée » avec organe, date, référence et pièce", async () => {
    utilisateur = { role: "BATONNIER", permissions: ["discipline_decider"] };
    getDossier.mockResolvedValue({ ...dossier, statut: "decision", sanctionCode: "REPRIMANDE", sanction: "Réprimande", decidePar: "Conseil de discipline (art. 36, loi n° 026-92)", dateDecision: "2026-10-01", motivation: "Faits établis" });
    monter();
    await ouvrirOnglet();
    expect(await screen.findByText(/Décision enregistrée : Réprimande/)).toBeInTheDocument();
    expect(screen.getByText(/Organe : Conseil de discipline/)).toBeInTheDocument();
    expect(screen.getByText(/Référence :/)).toBeInTheDocument();
    expect(screen.getByText(/Pièce : décision en PDF/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer la décision" })).toBeNull();
  });

  it("n'emploie aucun libellé étranger à l'art. 36 dans les écrans de discipline", () => {
    for (const f of ["../DossierDetail.jsx", "../Discipline.jsx"]) {
      // "SUSPENSION" est un code d'effet interne du catalogue, jamais affiché.
      const src = readFileSync(new URL(f, import.meta.url), "utf8").replaceAll("\"SUSPENSION\"", "");
      expect(src).not.toMatch(/bl[âa]me|suspension|prononcée par le bâtonnier/i);
    }
  });
});
