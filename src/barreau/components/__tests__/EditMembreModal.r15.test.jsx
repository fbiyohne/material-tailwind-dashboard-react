import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { EditMembreModal } from "../EditMembreModal";

vi.mock("../../api/resources", () => ({ modifierMembre: vi.fn() }));

const rendre = (m, props = {}) =>
  render(
    <ToastProvider><ConfirmProvider>
      <EditMembreModal membre={{ id: 1, nom: "R15 Test", dateDeces: null, ...m }} open onClose={() => {}} {...props} />
    </ConfirmProvider></ToastProvider>
  );

// R1-5 : omission, réinscription et passage au tableau ne se font pas par « Modifier ».
describe("EditMembreModal — transitions réservées à leur circuit (R1-5)", () => {
  it("inscrit : « Omis » n'est pas proposé", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" });
    expect(screen.queryByRole("option", { name: "Omis" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Statut/)).toBeEnabled();
  });

  it("omis : statut verrouillé, renvoi vers le menu Actions (réinscription)", () => {
    rendre({ qualite: "titulaire", statut: "omis" });
    expect(screen.getByLabelText(/^Statut/)).toBeDisabled();
    expect(screen.getByLabelText(/^Statut/)).toHaveValue("omis");
    expect(screen.getByText(/réinscription : menu Actions/)).toBeInTheDocument();
  });

  it("stagiaire : ni « Inscrit » ni « Honoraire », renvoi vers l'onglet Stage", () => {
    rendre({ qualite: "stagiaire", statut: "stagiaire" });
    expect(screen.getByLabelText(/^Statut/)).toHaveValue("stagiaire");
    expect(screen.queryByRole("option", { name: "Inscrit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Honoraire" })).not.toBeInTheDocument();
    expect(screen.getByText(/onglet Stage/)).toBeInTheDocument();
  });
});

// R1-7 et O2 : la radiation s'enregistre depuis le dossier disciplinaire, jamais par « Modifier ».
describe("EditMembreModal — radiation hors de la fiche (R1-7, O2)", () => {
  it("« Radié » n'est pas proposé pour un inscrit", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" });
    expect(screen.queryByRole("option", { name: "Radié" })).not.toBeInTheDocument();
    // T6 : le décès se déclare par l'action dédiée (pièce justificative), pas par la fiche.
    expect(screen.queryByRole("option", { name: "Décédé" })).not.toBeInTheDocument();
  });

  it("la prop peutRadier n'existe plus : même un titulaire de discipline_decider ne voit pas « Radié »", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" }, { peutRadier: true });
    expect(screen.queryByRole("option", { name: "Radié" })).not.toBeInTheDocument();
  });

  it("radié, SG : seul « Radié », date et référence corrigeables (décès : action dédiée, T6)", () => {
    rendre({ qualite: "titulaire", statut: "radie", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 17" });
    expect(within(screen.getByLabelText(/^Statut/)).getAllByRole("option").map((o) => o.textContent)).toEqual(["Radié"]);
    expect(screen.getByLabelText(/Date de la décision/)).toHaveValue("2026-10-01");
    expect(screen.getByText(/conseil de discipline/)).toBeInTheDocument();
  });
});

// R1-1 : imposer une suspension relève de discipline_decider (PATCH → 403 sinon) : elle
// s'enregistre par la décision du dossier disciplinaire.
describe("EditMembreModal — suspension réservée à discipline_decider (R1-1)", () => {
  it("SG (sans permission) : « Suspendu » n'est pas proposé pour un inscrit, renvoi vers le dossier disciplinaire", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" });
    expect(screen.queryByRole("option", { name: "Suspendu" })).not.toBeInTheDocument();
    expect(screen.getByText(/dossier disciplinaire/)).toBeInTheDocument();
  });

  it("suspension : jamais proposée pour un inscrit, quelle que soit la permission", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" }, { peutRadier: true });
    expect(screen.queryByRole("option", { name: "Suspendu" })).not.toBeInTheDocument();
  });

  it("suspendu, SG : statut courant affiché, retour au tableau proposé", () => {
    rendre({ qualite: "titulaire", statut: "suspendu" });
    expect(screen.getByLabelText(/^Statut/)).toHaveValue("suspendu");
    expect(screen.getByRole("option", { name: "Inscrit" })).toBeInTheDocument();
  });
});
