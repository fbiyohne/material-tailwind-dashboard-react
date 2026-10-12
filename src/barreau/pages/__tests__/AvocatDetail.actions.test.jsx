import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { AvocatDetail } from "../AvocatDetail";
import { getMembre, listerEvenements, declarerDeces, supprimerMembre } from "../../api/resources";
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
const rendre = () =>
  render(
    <MemoryRouter initialEntries={["/avocats/7"]}>
      <ToastProvider><ConfirmProvider>
        <Routes><Route path="/avocats/:id" element={<AvocatDetail />} /></Routes>
      </ConfirmProvider></ToastProvider>
    </MemoryRouter>
  );
const ouvrirMenu = async () => {
  await userEvent.click(await screen.findByRole("button", { name: /^Actions/ }));
  return screen.getByRole("menu", { name: "Actions" });
};
const entree = (menu, nom) => within(menu).getByRole("menuitem", { name: nom });
const libelles = (menu) => within(menu).getAllByRole("menuitem").map((b) => b.textContent.trim());

beforeEach(() => { vi.clearAllMocks(); listerEvenements.mockResolvedValue([]); });

describe("AvocatDetail — en-tête en boutons-icônes et menu Actions (O2)", () => {
  it("ADMIN, inscrit : deux boutons-icônes étiquetés et les 6 entrées demandées, dans l'ordre", async () => {
    useAuth.mockReturnValue({ user: { role: "ADMIN", permissions: ["messagerie"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    for (const nom of ["Modifier la fiche", "Générer une attestation d'inscription"]) {
      const b = await screen.findByRole("button", { name: nom });
      expect(b).toHaveAttribute("title");
      expect(b.textContent.trim()).toBe(""); // icône seule, nom porté par aria-label
    }
    const menu = await ouvrirMenu();
    const l = libelles(menu);
    const ordre = ["Contacter", "Modifier", "Accès espace", "Attestation", "Déclarer le décès", "Supprimer"].map((x) => l.indexOf(x));
    expect(ordre.every((i) => i >= 0)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    // Les actions de parcours s'intercalent entre Attestation et les actions destructives.
    expect(l.indexOf("Enregistrer un rappel")).toBeGreaterThan(l.indexOf("Attestation"));
    expect(l.indexOf("Enregistrer un rappel")).toBeLessThan(l.indexOf("Déclarer le décès"));
    for (const nom of ["Déclarer le décès", "Supprimer"]) expect(entree(menu, nom).className).toMatch(/text-rouge/);
  });

  it("aucune entrée ni bouton « Radier », même pour le titulaire de discipline_decider", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["membres", "discipline", "discipline_decider", "messagerie"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    const menu = await ouvrirMenu();
    expect(within(menu).queryByRole("menuitem", { name: /Radi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Radier/ })).not.toBeInTheDocument();
  });

  it("selon les permissions : le Bâtonnier sans droit de gestion n'a ni Modifier, ni décès, ni Supprimer", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["messagerie"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    const menu = await ouvrirMenu();
    expect(libelles(menu)).toEqual(["Contacter"]);
    expect(screen.queryByRole("button", { name: "Modifier la fiche" })).not.toBeInTheDocument();
  });

  it("sans aucune action permise, pas de bouton Actions", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: [] } });
    getMembre.mockResolvedValue(base);
    rendre();
    expect(await screen.findByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Actions/ })).not.toBeInTheDocument();
  });

  it("ancien membre (radié) : Contacter, Accès espace et Attestation grisés avec leur motif, aucune action de parcours", async () => {
    useAuth.mockReturnValue({ user: { role: "ADMIN", permissions: ["messagerie"] } });
    getMembre.mockResolvedValue({ ...base, statut: "radie", dateRadiation: "2026-10-01" });
    rendre();
    const menu = await ouvrirMenu();
    for (const nom of ["Contacter", "Accès espace", "Attestation"]) {
      expect(entree(menu, nom)).toHaveAttribute("aria-disabled", "true");
      expect(entree(menu, nom)).toHaveAttribute("title");
    }
    for (const nom of ["Modifier", "Déclarer le décès", "Supprimer"]) expect(entree(menu, nom)).not.toHaveAttribute("aria-disabled");
    expect(within(menu).queryByRole("menuitem", { name: /rappel|omission|Réinscrire/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Générer une attestation d'inscription" })).not.toBeInTheDocument();
  });

  it("Déclarer le décès : sans pièce justificative, rien n'est envoyé", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: [] } });
    getMembre.mockResolvedValue(base);
    rendre();
    await userEvent.click(entree(await ouvrirMenu(), "Déclarer le décès"));
    const dlg = screen.getByRole("dialog", { name: "Déclarer le décès de Me BAKALA Jean" });
    await userEvent.type(within(dlg).getByLabelText(/Date du décès/), "2026-09-15");
    await userEvent.click(within(dlg).getByRole("button", { name: /Déclarer le décès/ }));
    expect(await within(dlg).findByText(/Indiquez l'acte ou le certificat de décès/)).toBeInTheDocument();
    expect(declarerDeces).not.toHaveBeenCalled();
    expect(within(dlg).queryByLabelText(/^Cause/)).not.toBeInTheDocument(); // aucune cause du décès (R-15)
  });

  it("Supprimer : clause CL-SUPPRESSION, confirmation par saisie du numéro, refus 409 affiché", async () => {
    useAuth.mockReturnValue({ user: { role: "ADMIN", permissions: [] } });
    getMembre.mockResolvedValue(base);
    const msg = "Suppression refusée : cette fiche a un historique (pièces comptables, parcours). Enregistrez une sortie du tableau.";
    supprimerMembre.mockRejectedValue(new Error(msg));
    rendre();
    await userEvent.click(entree(await ouvrirMenu(), "Supprimer"));
    const dlg = screen.getByRole("dialog");
    expect(dlg).toHaveTextContent("La suppression est réservée à une fiche créée par erreur, sans historique. Pour un avocat qui quitte l'Ordre, enregistrez sa sortie. Cette action est tracée et irréversible.");
    const ok = within(dlg).getByRole("button", { name: "Supprimer" });
    expect(ok).toBeDisabled();
    const saisie = within(dlg).getByRole("textbox");
    await userEvent.type(saisie, "PN-2010-01");
    expect(ok).toBeDisabled();
    await userEvent.type(saisie, "2");
    expect(ok).toBeEnabled();
    await userEvent.click(ok);
    expect(supprimerMembre).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(msg));
    expect(screen.getByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
  });
});
