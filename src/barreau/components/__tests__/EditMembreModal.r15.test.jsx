import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { EditMembreModal } from "../EditMembreModal";

vi.mock("../../api/resources", () => ({ modifierMembre: vi.fn() }));

const rendre = (m) =>
  render(
    <ToastProvider><ConfirmProvider>
      <EditMembreModal membre={{ id: 1, nom: "R15 Test", dateDeces: null, ...m }} open onClose={() => {}} />
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
