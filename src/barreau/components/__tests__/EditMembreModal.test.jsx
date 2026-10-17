import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../Toast";
import { ConfirmProvider } from "../ConfirmDialog";
import { EditMembreModal } from "../EditMembreModal";
import { modifierMembre } from "../../api/resources";

vi.mock("../../api/resources", () => ({ modifierMembre: vi.fn() }));

const membre = { id: 7, nom: "BAKALA Jean", qualite: "titulaire", statut: "decede", dateDeces: "2026-09-15", dateRadiation: null, motifRadiation: null };
const rendre = (m = membre) =>
  render(
    <ToastProvider><ConfirmProvider>
      <EditMembreModal membre={m} open onClose={() => {}} onSaved={() => {}} />
    </ConfirmProvider></ToastProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("EditMembreModal — statut Décédé et champs de dates", () => {
  it("propose « Décédé » et affiche la date du décès pour un membre décédé", () => {
    rendre();
    expect(screen.getByRole("option", { name: "Décédé" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date du décès/)).toHaveValue("2026-09-15");
    expect(screen.queryByLabelText(/Date de la décision/)).not.toBeInTheDocument();
  });

  it("radié : date et référence de la décision affichées, pas de date de décès", async () => {
    // O2 : « Radié » n'est jamais un choix ; seul un membre déjà radié l'affiche (correction).
    rendre({ ...membre, statut: "radie", dateDeces: null, dateRadiation: "2026-10-01", motifRadiation: "Décision n° 3" });
    expect(screen.queryByLabelText(/Date du décès/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Date de la décision/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Référence et motif/)).toBeInTheDocument();
  });

  it("enregistre INSCRIT avec dateDeces effacée (null)", async () => {
    modifierMembre.mockResolvedValue({ ...membre, statut: "inscrit", dateDeces: null });
    rendre();
    await userEvent.selectOptions(screen.getByLabelText(/^Statut/), "inscrit");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(modifierMembre).toHaveBeenCalled());
    const [, patch] = modifierMembre.mock.calls[0];
    expect(patch.statut).toBe("inscrit");
    expect(patch.dateDeces).toBeNull();
    // Date de naissance absente : omise, jamais null (le serveur la refuserait en 400).
    expect(patch.dateNaissance).toBeUndefined();
  });
});
