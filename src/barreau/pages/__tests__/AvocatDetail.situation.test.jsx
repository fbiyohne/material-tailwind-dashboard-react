import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { AvocatDetail } from "../AvocatDetail";
import { getMembre, listerEvenements, enregistrerEvenement, contacterMembre } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";

vi.mock("../../api/resources", () => ({
  getMembre: vi.fn(), getDroits: vi.fn().mockResolvedValue({ lignes: [] }),
  radierMembre: vi.fn(), declarerDeces: vi.fn(), supprimerMembre: vi.fn(), provisionnerAccesAvocat: vi.fn(),
  telechargerQuitusPdf: vi.fn(), telechargerRecuPdf: vi.fn(), telechargerAttestationPdf: vi.fn(),
  modifierMembre: vi.fn(), genererAttestation: vi.fn(),
  casierDiscipline: vi.fn().mockResolvedValue([]), listerPieces: vi.fn().mockResolvedValue([]),
  listerRapportsStage: vi.fn().mockResolvedValue([]),
  listerEvenements: vi.fn(), enregistrerEvenement: vi.fn(), contacterMembre: vi.fn(),
}));
vi.mock("../../auth/AuthContext", () => ({ useAuth: vi.fn() }));

const base = { id: 7, num: 12, numInscription: "PN-2010-012", nom: "BAKALA Jean", qualite: "titulaire", statut: "inscrit", cabinet: "Cabinet X", cotisations: [], recus: [], quitus: [] };
const EVENEMENTS = [
  { id: 2, type: "SANCTION", dateEffet: "2026-08-02T00:00:00.000Z", motif: "Interdiction temporaire (3 mois, avec sursis)", reference: "CD-2026-04", details: { sursis: true, decidePar: "Conseil de discipline" }, acteurNom: "Me Bâtonnier" },
  { id: 1, type: "INSCRIPTION", dateEffet: "2010-03-01T00:00:00.000Z", acteurNom: "Secrétariat" },
];
const rendre = () =>
  render(
    <MemoryRouter initialEntries={["/avocats/7"]}>
      <ToastProvider><ConfirmProvider>
        <Routes><Route path="/avocats/:id" element={<AvocatDetail />} /></Routes>
      </ConfirmProvider></ToastProvider>
    </MemoryRouter>
  );
const ouvrirSituation = async () => userEvent.click(await screen.findByRole("tab", { name: /Situation/ }));

beforeEach(() => { vi.clearAllMocks(); getMembre.mockResolvedValue(base); listerEvenements.mockResolvedValue(EVENEMENTS); });

describe("AvocatDetail — historique, sursis, Contacter", () => {
  it("rend la frise des événements, la mention de sursis (C-06) et le bouton Contacter", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["messagerie"] } });
    rendre();
    await ouvrirSituation();
    expect(await screen.findByRole("list", { name: "Historique de la situation" })).toBeInTheDocument();
    expect(screen.getByText(/Sanction enregistrée — avec sursis/)).toBeInTheDocument();
    expect(screen.getByText(/Réf\. CD-2026-04/)).toBeInTheDocument();
    expect(screen.getByText(/Inscription/)).toBeInTheDocument();
    expect(screen.getByText(/Sanction avec sursis enregistrée : l'avocat reste inscrit/)).toBeInTheDocument();
    expect(screen.getByText(/n'est pas prévu par la loi/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contacter/ })).toBeInTheDocument();
  });

  it("Contacter envoie le message via POST /messagerie", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: ["messagerie"] } });
    contacterMembre.mockResolvedValue({ id: 1 });
    rendre();
    await userEvent.click(await screen.findByRole("button", { name: /Contacter/ }));
    await userEvent.type(screen.getByLabelText(/Objet/), "Cotisation");
    await userEvent.type(screen.getByLabelText(/Message/), "Bonjour");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(contacterMembre).toHaveBeenCalledWith({ membreId: 7, sujet: "Cotisation", corps: "Bonjour" });
  });

  it("les actions sont masquées sans la permission correspondante", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: [] } });
    rendre();
    await ouvrirSituation();
    await screen.findByRole("list", { name: "Historique de la situation" });
    for (const nom of [/Enregistrer un rappel/, /Enregistrer l'omission/, /Réinscrire/, /Démission/, /Contacter/]) {
      expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
    }
  });

  it("omission : permission omission_prononcer, référence obligatoire, envoi à l'API", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["omission_prononcer", "finances"] } });
    enregistrerEvenement.mockResolvedValue({});
    rendre();
    await ouvrirSituation();
    expect(screen.queryByRole("button", { name: /Démission/ })).not.toBeInTheDocument(); // SG seul
    await userEvent.click(await screen.findByRole("button", { name: /Enregistrer l'omission/ }));
    expect(screen.getByText(/Conseil de l'Ordre national : le logiciel l'enregistre/)).toBeInTheDocument();
    const ok = screen.getByRole("button", { name: "Enregistrer" });
    expect(ok).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Référence/), "CON-2026-09");
    await userEvent.click(ok);
    expect(enregistrerEvenement).toHaveBeenCalledWith(7, expect.objectContaining({ type: "OMISSION", reference: "CON-2026-09", cause: "35-4" }));
  });

  it("le SG voit les sorties volontaires", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: [] } });
    rendre();
    await ouvrirSituation();
    expect(await screen.findByRole("button", { name: /Démission/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enregistrer l'omission/ })).not.toBeInTheDocument();
  });

  it("un échec de l'historique n'empêche pas la fiche", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: [] } });
    listerEvenements.mockRejectedValue(new Error("boom"));
    rendre();
    await ouvrirSituation();
    expect(await screen.findByText(/Historique indisponible : boom/)).toBeInTheDocument();
  });
});
