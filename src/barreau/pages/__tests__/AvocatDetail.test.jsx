import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { AvocatDetail } from "../AvocatDetail";
import { getMembre, getDroits, supprimerMembre } from "../../api/resources";
import { useAuth } from "../../auth/AuthContext";

vi.mock("../../api/resources", () => ({
  getMembre: vi.fn(),
  getDroits: vi.fn().mockResolvedValue({ lignes: [] }),
  radierMembre: vi.fn(),
  declarerDeces: vi.fn(),
  supprimerMembre: vi.fn(),
  provisionnerAccesAvocat: vi.fn(),
  telechargerQuitusPdf: vi.fn(),
  telechargerRecuPdf: vi.fn(),
  telechargerAttestationPdf: vi.fn(),
  modifierMembre: vi.fn(),
  genererAttestation: vi.fn(),
  casierDiscipline: vi.fn().mockResolvedValue([]),
  listerPieces: vi.fn().mockResolvedValue([]),
  listerRapportsStage: vi.fn().mockResolvedValue([]),
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

beforeEach(() => vi.clearAllMocks());

// Les actions passent par le menu « Actions » (O2) ; la radiation n'est plus proposée
// sur la fiche : elle s'enregistre depuis le dossier disciplinaire.
const ouvrirMenu = async () => {
  await userEvent.click(await screen.findByRole("button", { name: /^Actions/ }));
  return screen.getByRole("menu", { name: "Actions" });
};

describe("AvocatDetail — actions selon rôle et statut", () => {
  it("SG, membre inscrit : Déclarer le décès au menu, aucun Radier", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: ["membres", "discipline", "discipline_saisir"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    const menu = await ouvrirMenu();
    expect(within(menu).getByRole("menuitem", { name: "Déclarer le décès" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: /Radi/ })).not.toBeInTheDocument();
  });

  it("BATONNIER avec discipline_decider : ni Radier, ni Modifier, ni décès sur la fiche", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["membres", "discipline", "discipline_decider"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    expect(await screen.findByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
    for (const nom of [/Radier/, /Actions/, /Modifier/]) expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
  });

  it("SG, membre décédé : badge, ligne « Décédé le », Accès espace grisé, attestation de sortie et correction de date possibles", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getMembre.mockResolvedValue({ ...base, statut: "decede", dateDeces: "2026-09-15" });
    rendre();
    expect(await screen.findByText("Décédé")).toBeInTheDocument();
    expect(screen.getByText("Décédé le")).toBeInTheDocument();
    expect(screen.getByText("15/09/2026")).toBeInTheDocument();
    const menu = await ouvrirMenu();
    expect(within(menu).queryByRole("menuitem", { name: "Déclarer le décès" })).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Accès espace" })).toHaveAttribute("aria-disabled", "true");
    // Ancien membre (H2) : l'attestation délivrée est celle de sortie du tableau.
    expect(within(menu).getByRole("menuitem", { name: "Attestation" })).not.toHaveAttribute("aria-disabled");
    // Correction de la date du décès (T6) : Modifier reste disponible.
    expect(within(menu).getByRole("menuitem", { name: "Modifier" })).not.toHaveAttribute("aria-disabled");
  });

  it("décédé : aucune créance de plaidoirie affichée, même si le serveur renvoie une ligne", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getDroits.mockResolvedValue({ lignes: [{ membre: { id: 7 }, du: 60000, paye: 0, solde: 60000 }] });
    getMembre.mockResolvedValue({ ...base, statut: "decede", dateDeces: "2026-09-15" });
    rendre();
    expect(await screen.findByText(/Sans objet — avocat décédé/)).toBeInTheDocument();
    expect(screen.queryByText(/60\s?000/)).not.toBeInTheDocument();
  });


  it("SG, membre radié : ligne « Radié le — motif », fiche en lecture seule sauf l'attestation de sortie", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getMembre.mockResolvedValue({ ...base, statut: "radie", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 12" });
    rendre();
    expect(await screen.findByText("Radié le")).toBeInTheDocument();
    expect(screen.getByText("01/10/2026 — Décision n° 12")).toBeInTheDocument();
    const menu = await ouvrirMenu();
    expect(within(menu).queryByRole("menuitem", { name: /Radi/ })).not.toBeInTheDocument();
    for (const nom of ["Modifier", "Accès espace", "Déclarer le décès"]) expect(within(menu).getByRole("menuitem", { name: nom })).toHaveAttribute("aria-disabled", "true");
    expect(within(menu).getByRole("menuitem", { name: "Attestation" })).not.toHaveAttribute("aria-disabled");
  });

  it("BATONNIER sans permission : aucun menu Actions (ni Radier, ni décès, ni Supprimer, ni Modifier)", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER" } });
    getMembre.mockResolvedValue(base);
    rendre();
    expect(await screen.findByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
    for (const nom of [/Radier/, /Actions/, /Supprimer/, /Modifier/]) {
      expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
    }
  });

  it("ADMIN : Supprimer affiche le message 409 du serveur sans casser la page", async () => {
    useAuth.mockReturnValue({ user: { role: "ADMIN" } });
    getMembre.mockResolvedValue(base);
    const msg = "Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès";
    supprimerMembre.mockRejectedValue(new Error(msg));
    rendre();
    await userEvent.click(within(await ouvrirMenu()).getByRole("menuitem", { name: "Supprimer" }));
    const dlg = screen.getByRole("dialog");
    await userEvent.type(within(dlg).getByRole("textbox"), "PN-2010-012");
    await userEvent.click(within(dlg).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(msg));
    expect(screen.getByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
  });
});
