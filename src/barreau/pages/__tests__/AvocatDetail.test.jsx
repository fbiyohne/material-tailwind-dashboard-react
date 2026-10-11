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

describe("AvocatDetail — actions selon rôle et statut", () => {
  it("SG, membre inscrit : Déclarer le décès, pas de Radier (R1-7 : discipline_decider)", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL", permissions: ["membres", "discipline", "discipline_saisir"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    expect(await screen.findByRole("button", { name: /Déclarer le décès/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Radier/ })).not.toBeInTheDocument();
  });

  it("BATONNIER avec discipline_decider : Radier ouvre la modale, sans Modifier ni décès", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER", permissions: ["membres", "discipline", "discipline_decider"] } });
    getMembre.mockResolvedValue(base);
    rendre();
    await userEvent.click(await screen.findByRole("button", { name: /Radier/ }));
    expect(screen.getByRole("dialog", { name: "Radier Me BAKALA Jean" })).toBeInTheDocument();
    for (const nom of [/Déclarer le décès/, /Modifier/]) expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
  });

  it("SG, membre décédé : badge, ligne « Décédé le », actions masquées", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getMembre.mockResolvedValue({ ...base, statut: "decede", dateDeces: "2026-09-15" });
    rendre();
    expect(await screen.findByText("Décédé")).toBeInTheDocument();
    expect(screen.getByText("Décédé le")).toBeInTheDocument();
    expect(screen.getByText("15/09/2026")).toBeInTheDocument();
    for (const nom of [/Radier/, /Déclarer le décès/, /Attestation/, /Accès espace/]) {
      expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /Modifier/ })).toBeInTheDocument();
  });

  it("décédé : aucune créance de plaidoirie affichée, même si le serveur renvoie une ligne", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getDroits.mockResolvedValue({ lignes: [{ membre: { id: 7 }, du: 60000, paye: 0, solde: 60000 }] });
    getMembre.mockResolvedValue({ ...base, statut: "decede", dateDeces: "2026-09-15" });
    rendre();
    expect(await screen.findByText(/Sans objet — avocat décédé/)).toBeInTheDocument();
    expect(screen.queryByText(/60\s?000/)).not.toBeInTheDocument();
  });

  it("SG, membre radié : ligne « Radié le — motif », Accès espace et Attestation masqués, décès possible", async () => {
    useAuth.mockReturnValue({ user: { role: "SECRETAIRE_GENERAL" } });
    getMembre.mockResolvedValue({ ...base, statut: "radie", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 12" });
    rendre();
    expect(await screen.findByText("Radié le")).toBeInTheDocument();
    expect(screen.getByText("01/10/2026 — Décision n° 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Radier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attestation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Accès espace/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Déclarer le décès/ })).toBeInTheDocument();
  });

  it("BATONNIER sans discipline_decider : aucun bouton Radier / Déclarer le décès / Supprimer", async () => {
    useAuth.mockReturnValue({ user: { role: "BATONNIER" } });
    getMembre.mockResolvedValue(base);
    rendre();
    expect(await screen.findByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
    for (const nom of [/Radier/, /Déclarer le décès/, /Supprimer/, /Modifier/]) {
      expect(screen.queryByRole("button", { name: nom })).not.toBeInTheDocument();
    }
  });

  it("ADMIN : Supprimer affiche le message 409 du serveur sans casser la page", async () => {
    useAuth.mockReturnValue({ user: { role: "ADMIN" } });
    getMembre.mockResolvedValue(base);
    const msg = "Suppression impossible : pièces comptables à conserver 10 ans (OHADA) ; utilisez radiation ou décès";
    supprimerMembre.mockRejectedValue(new Error(msg));
    rendre();
    await userEvent.click(await screen.findByRole("button", { name: /Supprimer/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(msg));
    expect(screen.getByRole("heading", { name: "Me BAKALA Jean" })).toBeInTheDocument();
  });
});
