import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../Toast";
import { ActeStatutModal } from "../ActeStatutModal";
import { radierMembre, declarerDeces } from "../../api/resources";
import { dateLocaleISO } from "../../utils/format";

vi.mock("../../api/resources", () => ({
  radierMembre: vi.fn(),
  declarerDeces: vi.fn(),
}));

const membre = { id: 7, nom: "BAKALA Jean", statut: "inscrit" };
const rendre = (props) =>
  render(
    <ToastProvider>
      <ActeStatutModal membre={membre} open onClose={() => {}} onDone={() => {}} {...props} />
    </ToastProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe("ActeStatutModal — radiation", () => {
  it("pré-remplit la date du jour, borne à aujourd'hui, motif facultatif", () => {
    rendre({ mode: "radiation" });
    expect(screen.getByRole("dialog", { name: "Radier Me BAKALA Jean" })).toBeInTheDocument();
    const date = screen.getByLabelText(/Date de la décision/);
    expect(date).toHaveValue(dateLocaleISO());
    expect(date).toHaveAttribute("max", dateLocaleISO());
    expect(screen.getByRole("note")).toHaveTextContent("art. 36");
    expect(screen.getByRole("button", { name: "Radier" })).toBeEnabled();
  });

  it("envoie date et motif, puis appelle onDone et ferme", async () => {
    radierMembre.mockResolvedValue({ ...membre, statut: "radie" });
    const onDone = vi.fn();
    const onClose = vi.fn();
    rendre({ mode: "radiation", onDone, onClose });
    await userEvent.type(screen.getByLabelText(/Référence et motif/), "Décision n° 12");
    await userEvent.click(screen.getByRole("button", { name: "Radier" }));
    await waitFor(() => expect(radierMembre).toHaveBeenCalledWith(7, { dateRadiation: dateLocaleISO(), motifRadiation: "Décision n° 12" }));
    expect(onDone).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/radié\(e\) — décision du \d{2}\/\d{2}\/\d{4}/);
  });

  it("refuse une date postérieure à aujourd'hui sans appeler l'API", async () => {
    rendre({ mode: "radiation" });
    const date = screen.getByLabelText(/Date de la décision/);
    await userEvent.clear(date);
    await userEvent.type(date, "2099-01-01");
    await userEvent.click(screen.getByRole("button", { name: "Radier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La date ne peut pas être postérieure à aujourd'hui.");
    expect(radierMembre).not.toHaveBeenCalled();
  });

  it("affiche l'erreur serveur sous le champ et garde la modale ouverte", async () => {
    radierMembre.mockRejectedValue(new Error("Date invalide"));
    const onClose = vi.fn();
    rendre({ mode: "radiation", onClose });
    await userEvent.click(screen.getByRole("button", { name: "Radier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Date invalide");
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ActeStatutModal — décès", () => {
  it("exige une date : bouton désactivé tant que le champ est vide", async () => {
    rendre({ mode: "deces" });
    expect(screen.getByRole("dialog", { name: "Déclarer le décès de Me BAKALA Jean" })).toBeInTheDocument();
    const bouton = screen.getByRole("button", { name: "Déclarer le décès" });
    expect(bouton).toBeDisabled();
    const date = screen.getByLabelText(/Date du décès/);
    expect(date).toHaveValue("");
    expect(date).toHaveAttribute("max", dateLocaleISO());
    await userEvent.type(date, "2026-09-15");
    expect(bouton).toBeEnabled();
    expect(screen.queryByLabelText(/motif/i)).not.toBeInTheDocument();
  });

  it("T6 : sans pièce justificative, rien n'est envoyé et le champ est signalé", async () => {
    rendre({ mode: "deces" });
    await userEvent.type(screen.getByLabelText(/Date du décès/), "2026-09-15");
    await userEvent.click(screen.getByRole("button", { name: "Déclarer le décès" }));
    expect(await screen.findByText(/acte ou le certificat de décès/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pièce justificative/)).toHaveFocus();
    expect(declarerDeces).not.toHaveBeenCalled();
  });

  it("déclare le décès et notifie", async () => {
    declarerDeces.mockResolvedValue({ ...membre, statut: "decede" });
    const onDone = vi.fn();
    rendre({ mode: "deces", onDone });
    await userEvent.type(screen.getByLabelText(/Date du décès/), "2026-09-15");
    await userEvent.type(screen.getByLabelText(/Pièce justificative/), "Acte de décès n° 412");
    await userEvent.click(screen.getByRole("button", { name: "Déclarer le décès" }));
    await waitFor(() => expect(declarerDeces).toHaveBeenCalledWith(7, "2026-09-15", "Acte de décès n° 412"));
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Décès de Me BAKALA Jean enregistré au 15/09/2026.");
  });
});
