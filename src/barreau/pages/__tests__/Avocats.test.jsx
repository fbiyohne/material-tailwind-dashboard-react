import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { ConfirmProvider } from "../../components/ConfirmDialog";
import { Avocats } from "../Avocats";
import { listerMembres, telechargerAvocatsPdf } from "../../api/resources";
import { telechargerTexte } from "../../utils/exportCsv";
import { exporterExcel, exporterPdf } from "../../utils/exports";

vi.mock("../../api/resources", () => ({
  listerMembres: vi.fn(),
  getCotisations: vi.fn().mockResolvedValue([]),
  supprimerMembre: vi.fn(),
  telechargerAvocatsPdf: vi.fn(),
}));
vi.mock("../../utils/exportCsv", async (orig) => ({ ...(await orig()), telechargerTexte: vi.fn() }));
vi.mock("../../utils/exports", () => ({ exporterExcel: vi.fn(), exporterPdf: vi.fn() }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ user: { role: "SECRETAIRE_GENERAL" } }) }));
vi.mock("../../components/AttestationModal", () => ({ AttestationModal: () => null }));

const membres = [
  { id: 1, num: 1, numInscription: "PN-2010-001", nom: "BAKALA Jean", qualite: "titulaire", statut: "inscrit", cabinet: "Cab; X", tel: "060", email: "a@b.cg", dateInscription: "2010-01-05", dateRadiation: null, dateDeces: null, motifRadiation: "SECRET", adresse: "Rue" },
  { id: 2, num: 2, numInscription: "PN-2011-002", nom: "NGOMA Paul", qualite: "titulaire", statut: "decede", cabinet: "", tel: "", email: "", dateInscription: "2011-02-06", dateRadiation: null, dateDeces: "2026-09-15" },
];

const rendre = async () => {
  listerMembres.mockResolvedValue({ items: membres });
  render(<MemoryRouter><ToastProvider><ConfirmProvider><Avocats /></ConfirmProvider></ToastProvider></MemoryRouter>);
  await screen.findByText("Me NGOMA Paul");
};
const exportVers = async (libelle, format) => {
  const resume = screen.getByLabelText(libelle);
  await userEvent.click(resume);
  await userEvent.click(within(resume.closest("details")).getByRole("button", { name: new RegExp(format) }));
};

beforeEach(() => vi.clearAllMocks());

describe("Avocats — exports", () => {
  it("CSV : BOM, mention, 11 colonnes, séparateur « ; », sans motif ni adresse", async () => {
    await rendre();
    await exportVers("Exporter", "CSV");
    const [nom, contenu] = telechargerTexte.mock.calls[0];
    expect(nom).toBe("Avocats.csv");
    expect(contenu.startsWith("﻿Barreau de Pointe-Noire — Document interne confidentiel")).toBe(true);
    const lignes = contenu.split("\r\n");
    expect(lignes[1]).toBe("N°;N° inscription;Nom;Qualité;Statut;Cabinet;Téléphone;Email;Date d'inscription;Date de radiation;Date de décès");
    expect(lignes).toHaveLength(2 + membres.length);
    expect(lignes[2]).toContain('"Cab; X"');
    expect(lignes[3]).toContain(";Décédé;");
    expect(contenu).not.toMatch(/SECRET|Rue|Me /);
  });

  it("TXT : tabulations, même en-tête", async () => {
    await rendre();
    await exportVers("Exporter", "Texte");
    const [nom, contenu] = telechargerTexte.mock.calls[0];
    expect(nom).toBe("Avocats.txt");
    expect(contenu.split("\r\n")[1].split("\t")).toHaveLength(11);
  });

  it("Excel : feuille « Avocats », mention puis en-tête puis lignes", async () => {
    await rendre();
    await exportVers("Exporter", "Excel");
    const [nom, lignes, feuille] = exporterExcel.mock.calls[0];
    expect(nom).toBe("Avocats");
    expect(feuille).toBe("Avocats");
    expect(lignes).toHaveLength(2 + membres.length);
    expect(lignes[1][2]).toBe("Nom");
  });

  it("PDF : serveur avec filtres ; sélection via ids=", async () => {
    await rendre();
    await exportVers("Exporter", "PDF");
    expect(telechargerAvocatsPdf).toHaveBeenCalledWith({ qualiteNot: "STAGIAIRE" });
    await userEvent.click(screen.getAllByRole("checkbox")[2]);
    await exportVers("Exporter la sélection", "PDF");
    expect(telechargerAvocatsPdf).toHaveBeenLastCalledWith({ qualiteNot: "STAGIAIRE", ids: "2" });
  });

  it("PDF : repli client et toast d'information si le serveur échoue", async () => {
    telechargerAvocatsPdf.mockRejectedValue(new Error("500"));
    await rendre();
    await exportVers("Exporter", "PDF");
    await waitFor(() => expect(exporterPdf).toHaveBeenCalledWith(expect.stringMatching(/^Avocats-\d{4}-\d{2}-\d{2}$/), "#zone-impression-avocats"));
    expect(await screen.findByText(/PDF généré sur cet appareil/)).toBeInTheDocument();
  });

  it("filtre Décédé proposé", async () => {
    await rendre();
    expect(screen.getByRole("option", { name: "Décédé" })).toBeInTheDocument();
  });
});
