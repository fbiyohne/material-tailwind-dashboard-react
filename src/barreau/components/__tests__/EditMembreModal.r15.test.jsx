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

  it("omis : statut verrouillé, renvoi vers l'onglet Situation", () => {
    rendre({ qualite: "titulaire", statut: "omis" });
    expect(screen.getByLabelText(/^Statut/)).toBeDisabled();
    expect(screen.getByLabelText(/^Statut/)).toHaveValue("omis");
    expect(screen.getByText(/onglet Situation/)).toBeInTheDocument();
  });

  it("stagiaire : ni « Inscrit » ni « Honoraire », renvoi vers l'onglet Stage", () => {
    rendre({ qualite: "stagiaire", statut: "stagiaire" });
    expect(screen.getByLabelText(/^Statut/)).toHaveValue("stagiaire");
    expect(screen.queryByRole("option", { name: "Inscrit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Honoraire" })).not.toBeInTheDocument();
    expect(screen.getByText(/onglet Stage/)).toBeInTheDocument();
  });
});

// R1-7 : enregistrer ou lever une radiation relève de discipline_decider (PATCH → 403 sinon).
describe("EditMembreModal — radiation réservée à discipline_decider (R1-7)", () => {
  it("SG (sans permission) : « Radié » n'est pas proposé pour un inscrit", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" });
    expect(screen.queryByRole("option", { name: "Radié" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Décédé" })).toBeInTheDocument();
  });

  it("titulaire de discipline_decider : « Radié » proposé", () => {
    rendre({ qualite: "titulaire", statut: "inscrit" }, { peutRadier: true });
    expect(screen.getByRole("option", { name: "Radié" })).toBeInTheDocument();
  });

  it("radié, SG : seuls « Radié » et « Décédé », date et référence corrigeables", () => {
    rendre({ qualite: "titulaire", statut: "radie", dateRadiation: "2026-10-01", motifRadiation: "Décision n° 17" });
    expect(within(screen.getByLabelText(/^Statut/)).getAllByRole("option").map((o) => o.textContent)).toEqual(["Radié", "Décédé"]);
    expect(screen.getByLabelText(/Date de la décision/)).toHaveValue("2026-10-01");
    expect(screen.getByText(/conseil de discipline/)).toBeInTheDocument();
  });
});
