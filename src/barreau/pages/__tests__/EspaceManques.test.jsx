import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { MaSituation } from "../espace/MaSituation";
import { EspaceDiscipline } from "../espace/EspaceDiscipline";
import { MesDocuments } from "../espace/MesDocuments";
import { MesTimbres } from "../espace/MesTimbres";
import { EspaceScrutins } from "../espace/EspaceScrutins";
import { MENTION_ACCES_PERSONNEL } from "../../data/institutionnel";
import * as api from "../../api/resources";

// T13 (audit espace avocat M-20261016) : affichage des routes /espace enrichies (E1 à E7).
vi.mock("../../api/resources", () => ({
  getEspaceMoi: vi.fn(), getEspaceParcours: vi.fn(), getEspaceDiscipline: vi.fn(),
  telechargerEspaceDecisionPdf: vi.fn(), getEspaceDocuments: vi.fn(), getEspacePieces: vi.fn(),
  telechargerEspaceRecuPdf: vi.fn(), telechargerEspaceQuitusPdf: vi.fn(), soumettreEspacePiece: vi.fn(),
  supprimerEspacePiece: vi.fn(), voirEspacePiece: vi.fn(), telechargerEspaceAttestationInscription: vi.fn(),
  telechargerEspaceAttestationNonRedevance: vi.fn(), getEspaceTimbres: vi.fn(), creerEspaceTimbre: vi.fn(),
  tracerUsageTimbre: vi.fn(), declarerEspaceTimbreUtilise: vi.fn(), getEspaceScrutins: vi.fn(), voterScrutin: vi.fn(),
}));

const enveloppe = (ui) => <MemoryRouter><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></MemoryRouter>;

const MOI = {
  membre: { id: 1, num: 7, numInscription: "BPN-7", nom: "Dupont", qualite: "stagiaire", statut: "suspendu", cabinet: null },
  annee: 2026,
  recouvrement: { type: "MISE_EN_DEMEURE", dateEffet: "2026-09-02" },
  situation: { cotisation: { du: 50000, paye: 0, solde: 50000, statut: "impaye", valideTresoriere: false }, droit: null },
  cotisations: [], droits: [],
};

beforeEach(() => vi.clearAllMocks());

describe("MaSituation — statut, recouvrement, parcours, stage", () => {
  it("affiche le statut, la mise en demeure, le parcours et le stage", async () => {
    api.getEspaceMoi.mockResolvedValue(MOI);
    api.getEspaceParcours.mockResolvedValue({
      evenements: [{ id: 1, type: "MISE_EN_DEMEURE", dateEffet: "2026-09-02", reference: "MD-1", motif: null }],
      stage: { dateServment: "2025-01-10", dureeMois: 36, maitreStage: "Me Okemba", finPrevue: "2028-01-10", stageValideAt: null },
    });
    render(enveloppe(<MaSituation />));
    expect(await screen.findByText("Suspendu")).toBeInTheDocument();
    expect(screen.getByText(/Mise en demeure du .* pour l'exercice 2026/)).toBeInTheDocument();
    expect(await screen.findByText("Mon parcours")).toBeInTheDocument();
    expect(screen.getByText("MD-1")).toBeInTheDocument();
    expect(screen.getByText("Mon stage")).toBeInTheDocument();
    expect(screen.getByText("Me Okemba")).toBeInTheDocument();
  });

  it("parcours vide : état vide, pas de bloc stage", async () => {
    api.getEspaceMoi.mockResolvedValue({ ...MOI, recouvrement: null });
    api.getEspaceParcours.mockResolvedValue({ evenements: [], stage: null });
    render(enveloppe(<MaSituation />));
    expect(await screen.findByText("Aucun événement")).toBeInTheDocument();
    expect(screen.queryByText("Mon stage")).toBeNull();
    expect(screen.queryByText(/Mise en demeure du/)).toBeNull();
  });

  it("recouvrement présent mais cotisation soldée : pas d'avis de recouvrement", async () => {
    api.getEspaceMoi.mockResolvedValue({ ...MOI, situation: { ...MOI.situation, cotisation: { du: 50000, paye: 50000, solde: 0, statut: "paye", valideTresoriere: true } } });
    api.getEspaceParcours.mockResolvedValue({ evenements: [], stage: null });
    render(enveloppe(<MaSituation />));
    expect(await screen.findByText("Suspendu")).toBeInTheDocument();
    expect(screen.queryByText(/Mise en demeure du/)).toBeNull();
  });

  it("parcours en erreur : état d'erreur avec reprise", async () => {
    api.getEspaceMoi.mockResolvedValue(MOI);
    api.getEspaceParcours.mockRejectedValue(new Error("x"));
    render(enveloppe(<MaSituation />));
    expect(await screen.findByText("Votre parcours n'a pas pu être chargé.")).toBeInTheDocument();
  });
});

describe("EspaceDiscipline — décision notifiée ou en attente", () => {
  it("décision notifiée : sursis, période, mention d'accès, PDF", async () => {
    api.getEspaceDiscipline.mockResolvedValue([{
      id: 1, reference: "D-1", objet: "Objet", statut: "decide", dateSaisine: "2026-01-01",
      decision: "<p>Décision</p>", sanction: "Blâme", sursis: true, sanctionDebut: "2026-03-01", sanctionFin: "2026-06-01",
      dateNotification: "2026-02-20", decidePar: "Conseil de discipline",
    }]);
    render(enveloppe(<EspaceDiscipline />));
    expect(await screen.findByText(MENTION_ACCES_PERSONNEL)).toBeInTheDocument();
    expect(screen.getByText("Sursis")).toBeInTheDocument();
    expect(screen.getByText(/^Du .* au /)).toBeInTheDocument();
    expect(screen.getByText("Notifiée le")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Décision \(PDF\)/ })).toBeInTheDocument();
  });

  it("décision non notifiée : avis d'attente, ni mention ni PDF", async () => {
    api.getEspaceDiscipline.mockResolvedValue([{ id: 2, reference: "D-2", objet: "O", statut: "ouvert", dateSaisine: "2026-01-01" }]);
    render(enveloppe(<EspaceDiscipline />));
    expect(await screen.findByText(/Décision en attente de notification/)).toBeInTheDocument();
    expect(screen.queryByText(MENTION_ACCES_PERSONNEL)).toBeNull();
    expect(screen.queryByRole("button", { name: /PDF/ })).toBeNull();
  });

  it("état vide et erreur", async () => {
    api.getEspaceDiscipline.mockResolvedValueOnce([]);
    const { unmount } = render(enveloppe(<EspaceDiscipline />));
    expect(await screen.findByText("Aucune procédure")).toBeInTheDocument();
    unmount();
    api.getEspaceDiscipline.mockRejectedValueOnce(new Error("x"));
    render(enveloppe(<EspaceDiscipline />));
    expect(await screen.findByText("Vos dossiers n'ont pas pu être chargés.")).toBeInTheDocument();
  });
});

describe("MesDocuments — validité du quitus, vérification, rejet motivé", () => {
  it("quitus : fin de validité, état expiré et lien de vérification", async () => {
    api.getEspaceDocuments.mockResolvedValue({
      recus: [{ id: 1, numero: "R-1", montant: 1000, annee: 2025, date: "2025-02-01", verif: "http://x/v/r/R-1.t" }],
      quitus: [{ id: 1, numero: "Q-1", annee: 2025, date: "2025-02-01", finValidite: "2025-12-31", verif: "http://x/v/q/Q-1.t" }],
    });
    api.getEspacePieces.mockResolvedValue([]);
    api.getEspaceMoi.mockResolvedValue(MOI);
    render(enveloppe(<MesDocuments />));
    expect(await screen.findByText(/Valable jusqu'au/)).toBeInTheDocument();
    expect(screen.getByText("Expiré")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vérifier/ })).toHaveAttribute("href", "http://x/v/q/Q-1.t");
  });

  it("pièce rejetée : motif et mention d'accès", async () => {
    api.getEspaceDocuments.mockResolvedValue({ recus: [], quitus: [] });
    api.getEspacePieces.mockResolvedValue([{ id: 3, type: "IDENTITE", nomFichier: "cni.pdf", statut: "REJETEE", note: "Illisible", createdAt: "2026-10-01" }]);
    api.getEspaceMoi.mockResolvedValue(MOI);
    render(enveloppe(<MesDocuments />));
    await userEvent.click(await screen.findByRole("tab", { name: /Pièces justificatives/ }));
    expect(await screen.findByText(/Motif : Illisible/)).toBeInTheDocument();
    expect(screen.getByText(MENTION_ACCES_PERSONNEL)).toBeInTheDocument();
  });

  it("erreur de chargement", async () => {
    api.getEspaceDocuments.mockRejectedValue(new Error("x"));
    api.getEspacePieces.mockResolvedValue([]);
    api.getEspaceMoi.mockResolvedValue(MOI);
    render(enveloppe(<MesDocuments />));
    expect(await screen.findByText("Vos documents n'ont pas pu être chargés.")).toBeInTheDocument();
  });
});

describe("MesTimbres — déclaration d'usage", () => {
  it("un timbre UTILISE n'est plus « Valide » ; un timbre valide peut être marqué utilisé", async () => {
    const t = (id, statut) => ({ id, numero: id, code: `c${id}`, affaire: `Aff ${id}`, statut, createdAt: "2026-10-01", membre: { nom: "X" } });
    api.getEspaceTimbres.mockResolvedValue({ montant: 15000, timbres: [t(1, "UTILISE"), t(2, "VALIDE")] });
    api.declarerEspaceTimbreUtilise.mockResolvedValue({ ok: true });
    render(enveloppe(<MesTimbres />));
    expect(await screen.findByText("Utilisé")).toBeInTheDocument();
    const boutons = screen.getAllByRole("button", { name: "Marquer utilisé" });
    expect(boutons).toHaveLength(1);
    // Action définitive : un refus de la confirmation n'appelle pas le serveur.
    await userEvent.click(boutons[0]);
    expect(await screen.findByText(/définitive/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(api.declarerEspaceTimbreUtilise).not.toHaveBeenCalled();
    // Accord : un seul appel.
    await userEvent.click(screen.getByRole("button", { name: "Marquer utilisé" }));
    await userEvent.click(await screen.findByRole("button", { name: "Confirmer l'utilisation" }));
    expect(api.declarerEspaceTimbreUtilise).toHaveBeenCalledTimes(1);
    expect(api.declarerEspaceTimbreUtilise).toHaveBeenCalledWith(2);
  });
});

describe("EspaceScrutins — date du scrutin", () => {
  it("affiche la date du scrutin", async () => {
    api.getEspaceScrutins.mockResolvedValue([{ id: 1, titre: "Conseil 2026", type: "CONSEIL", statut: "OUVERT", nbSieges: 2, dateScrutin: "2026-11-05", aDejaVote: false, eligible: true, candidats: [] }]);
    render(enveloppe(<EspaceScrutins />));
    expect(await screen.findByText(/Scrutin du/)).toBeInTheDocument();
  });
});
