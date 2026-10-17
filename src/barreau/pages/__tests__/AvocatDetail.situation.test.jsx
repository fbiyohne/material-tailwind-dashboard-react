import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
// Volontairement dans le désordre : la frise trie du plus récent au plus ancien.
const EVENEMENTS = [
  { id: 1, type: "INSCRIPTION", dateEffet: "2010-03-01T00:00:00.000Z", acteurNom: "Secrétariat" },
  { id: 3, type: "OMISSION", dateEffet: "2025-01-10T00:00:00.000Z", motif: "Art. 35-1° loi n° 026-92", reference: "CON-2025-01", details: { organe: "Conseil de l'Ordre national", cause: "35-1" } },
  { id: 2, type: "SANCTION", dateEffet: "2026-08-02T00:00:00.000Z", motif: "Interdiction temporaire (3 mois, avec sursis)", reference: "CD-2026-04", pieceId: 9, details: { sursis: true, decidePar: "Conseil de discipline" }, acteurNom: "Me Bâtonnier" },
];
const rendre = () =>
  render(
    <MemoryRouter initialEntries={["/avocats/7"]}>
      <ToastProvider><ConfirmProvider>
        <Routes><Route path="/avocats/:id" element={<AvocatDetail />} /></Routes>
      </ConfirmProvider></ToastProvider>
    </MemoryRouter>
  );
const ouvrirParcours = async () => userEvent.click(await screen.findByRole("tab", { name: /Parcours/ }));
const ouvrirMenu = async () => {
  await userEvent.click(await screen.findByRole("button", { name: /^Actions/ }));
  return screen.getByRole("menu", { name: "Actions" });
};

beforeEach(() => { vi.clearAllMocks(); getMembre.mockResolvedValue(base); listerEvenements.mockResolvedValue(EVENEMENTS); });

describe("AvocatDetail — onglet Parcours, sursis, Contacter", () => {
  it("onglet « Parcours » (plus de « Situation ») : explication, frise récente en tête, qui/quand/pourquoi/pièce, aucun bouton", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: ["omission_prononcer", "finances", "messagerie"] } });
    rendre();
    await ouvrirParcours();
    expect(screen.queryByRole("tab", { name: /Situation/ })).not.toBeInTheDocument();
    const panneau = screen.getByRole("tabpanel");
    expect(panneau).toHaveTextContent("Historique daté de chaque changement de situation de l'avocat : qui l'a décidé, quand, pourquoi, sur quelle pièce.");
    const frise = await within(panneau).findByRole("list", { name: "Parcours de l'avocat" });
    const etapes = within(frise).getAllByRole("listitem").map((li) => li.textContent);
    expect(etapes[0]).toMatch(/Sanction enregistrée — avec sursis/);
    expect(etapes[2]).toMatch(/Inscription/);
    expect(etapes[0]).toMatch(/Décidé par Conseil de discipline/);
    expect(etapes[0]).toMatch(/Réf\. CD-2026-04/);
    expect(etapes[0]).toMatch(/Pièce n° 9/);
    // Omission pour maladie : le code d'article seul, aucune donnée médicale.
    expect(etapes[1]).toMatch(/Art\. 35-1°/);
    expect(etapes[1]).toMatch(/Décidé par Conseil de l'Ordre national/);
    expect(within(panneau).queryAllByRole("button")).toHaveLength(0);
  });

  it("mention de sursis (C-06) renvoyant à l'onglet Parcours, et Contacter au menu Actions", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["messagerie"] } });
    rendre();
    expect(await screen.findByText(/Sanction avec sursis enregistrée : l'avocat reste inscrit/)).toBeInTheDocument();
    expect(screen.getByText(/n'est pas prévu par la loi/)).toBeInTheDocument();
    expect(screen.getByText(/voir l'onglet Parcours/)).toBeInTheDocument();
    expect(within(await ouvrirMenu()).getByRole("menuitem", { name: "Contacter" })).toBeInTheDocument();
  });

  it("Contacter envoie le message via POST /messagerie", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: ["messagerie"] } });
    contacterMembre.mockResolvedValue({ id: 1 });
    rendre();
    await userEvent.click(within(await ouvrirMenu()).getByRole("menuitem", { name: "Contacter" }));
    await userEvent.type(screen.getByLabelText(/Objet/), "Cotisation");
    await userEvent.type(screen.getByLabelText(/Message/), "Bonjour");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    expect(contacterMembre).toHaveBeenCalledWith({ membreId: 7, sujet: "Cotisation", corps: "Bonjour" });
  });

  it("les actions de parcours sont absentes du menu sans la permission correspondante", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: [] } });
    rendre();
    await ouvrirParcours();
    await screen.findByRole("list", { name: "Parcours de l'avocat" });
    expect(screen.queryByRole("button", { name: /^Actions/ })).not.toBeInTheDocument();
  });

  it("omission depuis le menu Actions : permission omission_prononcer, référence obligatoire, envoi à l'API", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["omission_prononcer", "finances"] } });
    enregistrerEvenement.mockResolvedValue({});
    rendre();
    const menu = await ouvrirMenu();
    expect(within(menu).queryByRole("menuitem", { name: /Démission/ })).not.toBeInTheDocument(); // SG seul
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Enregistrer l'omission/ }));
    const dlg = screen.getByRole("dialog", { name: "Enregistrer l'omission" });
    expect(within(dlg).getByText(/Conseil de l'Ordre national : le logiciel l'enregistre/)).toBeInTheDocument();
    const ok = within(dlg).getByRole("button", { name: "Enregistrer" });
    expect(ok).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText(/Référence/), "CON-2026-09");
    await userEvent.click(ok);
    expect(enregistrerEvenement).toHaveBeenCalledWith(7, expect.objectContaining({ type: "OMISSION", reference: "CON-2026-09", cause: "35-4" }));
  });

  it("le SG voit les sorties volontaires dans le menu, pas l'omission", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: [] } });
    rendre();
    const menu = await ouvrirMenu();
    expect(within(menu).getByRole("menuitem", { name: /Démission/ })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /Enregistrer l'omission/ })).not.toBeInTheDocument();
  });

  it("un échec de l'historique n'empêche pas la fiche", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: [] } });
    listerEvenements.mockRejectedValue(new Error("boom"));
    rendre();
    await ouvrirParcours();
    expect(await screen.findByText(/Parcours indisponible : boom/)).toBeInTheDocument();
  });
});
