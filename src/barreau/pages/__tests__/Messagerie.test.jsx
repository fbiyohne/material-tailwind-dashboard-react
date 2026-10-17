import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { ToastProvider } from "../../components/Toast";
import { Messagerie } from "../Messagerie";
import { EspaceMessagerie } from "../espace/EspaceMessagerie";
import { EspaceAnnuaire } from "../espace/EspaceAnnuaire";
import * as R from "../../api/resources";
import { telechargerPdf } from "../../api/client";

vi.mock("../../api/client", () => ({ telechargerPdf: vi.fn(), ouvrirFichierAuth: vi.fn() }));
vi.mock("../../hooks/useMessagerieRealtime", () => ({ useMessagerieRealtime: () => {} }));
vi.mock("../../api/resources", () => ({
  getMessagerie: vi.fn(), getConversationAdmin: vi.fn(), repondreConversationAdmin: vi.fn().mockResolvedValue({}), delivrerAttestationFil: vi.fn(),
  getEspaceMessagerie: vi.fn(), getEspaceConversation: vi.fn(), creerEspaceConversation: vi.fn(),
  repondreEspaceConversation: vi.fn().mockResolvedValue({}), getEspaceAnnuaire: vi.fn(), demanderAttestation: vi.fn(),
}));

const wrap = (ui, entree = "/") => render(<MemoryRouter initialEntries={[entree]}><ToastProvider>{ui}</ToastProvider></MemoryRouter>);
const fichier = (nom, octets, type = "application/pdf") => {
  const f = new File(["x"], nom, { type });
  Object.defineProperty(f, "size", { value: octets });
  return f;
};

const SUJET_ATT = "Demande d'attestation d'inscription";
const fil = {
  id: 1, sujet: SUJET_ATT, expediteur: "Me DUPONT", attestationType: "INSCRIPTION", attestationNumero: null,
  messages: [
    { id: 10, corps: "Bonjour", auteurNom: "Me DUPONT", estAdministration: false, createdAt: "2026-10-01T10:00:00Z" },
    { id: 11, corps: "Voici", auteurNom: "Secrétariat", estAdministration: true, createdAt: "2026-10-01T11:00:00Z", recuAt: "2026-10-01T11:05:00Z", luAt: null,
      piece: { nom: "Attestation-ATT-1.pdf", mime: "application/pdf", taille: 20480 } },
  ],
};

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  vi.clearAllMocks();
  R.getMessagerie.mockResolvedValue([{ id: 1, sujet: SUJET_ATT, expediteur: "Me DUPONT", nonLus: 0, apercu: null }]);
  R.getConversationAdmin.mockResolvedValue(fil);
});

const ouvrirFilAdmin = async () => {
  wrap(<Messagerie />);
  await userEvent.click(await screen.findByRole("button", { name: /Me DUPONT/ }));
};

describe("Messagerie (administration)", () => {
  it("affiche statut, pièce, lien d'accusé PDF et champ pièce jointe", async () => {
    await ouvrirFilAdmin();
    expect(await screen.findByText("Reçu")).toBeInTheDocument();
    expect(screen.getByText("Attestation-ATT-1.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aperçu/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Joindre un fichier")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Accusé de lecture/ }));
    expect(telechargerPdf).toHaveBeenCalledWith("/messagerie/messages/11/accuse/pdf", "Accuse-lecture-11.pdf");
  });

  it("délivre l'attestation demandée", async () => {
    R.delivrerAttestationFil.mockResolvedValue({ numero: "ATT-2026-0001" });
    await ouvrirFilAdmin();
    await userEvent.click(await screen.findByRole("button", { name: /Délivrer l'attestation/ }));
    expect(R.delivrerAttestationFil).toHaveBeenCalledWith(1);
  });

  it("refuse côté client une pièce de plus de 5 Mo et un format inconnu", async () => {
    await ouvrirFilAdmin();
    const champ = await screen.findByLabelText("Joindre un fichier");
    fireEvent.change(champ, { target: { files: [fichier("gros.pdf", 5 * 1024 * 1024 + 1)] } });
    expect(await screen.findByText(/Pièce trop volumineuse \(5 Mo au plus\)/)).toBeInTheDocument();
    expect(screen.queryByText("gros.pdf")).not.toBeInTheDocument();
    fireEvent.change(champ, { target: { files: [fichier("virus.exe", 10)] } });
    expect(await screen.findByText(/Format refusé/)).toBeInTheDocument();
  });

  it("envoie la pièce choisie avec la réponse", async () => {
    await ouvrirFilAdmin();
    fireEvent.change(await screen.findByLabelText("Joindre un fichier"), { target: { files: [new File(["abc"], "pj.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("pj.pdf")).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText(/Répondre/), "ok");
    await userEvent.click(screen.getByRole("button", { name: /Envoyer/ }));
    await waitFor(() => expect(R.repondreConversationAdmin).toHaveBeenCalledWith(1, "ok", { nomFichier: "pj.pdf", donnees: "YWJj" }));
  });
});

describe("EspaceMessagerie (avocat)", () => {
  beforeEach(() => {
    R.getEspaceMessagerie.mockResolvedValue([{ id: 2, sujet: "Sujet", interlocuteur: "Administration", avecAdministration: true, nonLus: 0, apercu: null }]);
    R.getEspaceConversation.mockResolvedValue({ id: 2, sujet: "Sujet", interlocuteur: "Administration", messages: [
      { id: 20, corps: "Salut", estMoi: true, auteurNom: "Moi", createdAt: "2026-10-01T10:00:00Z", recuAt: "2026-10-01T10:01:00Z", luAt: "2026-10-01T10:02:00Z" },
    ] });
    R.getEspaceAnnuaire.mockResolvedValue([]);
  });

  it("affiche Lu, l'accusé PDF, la clause d'information, sans promesse de preuve ni de chiffrement", async () => {
    const { container } = wrap(<EspaceMessagerie />);
    await userEvent.click(await screen.findByRole("button", { name: /Administration/ }));
    expect(await screen.findByText("Lu")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Accusé de lecture/ }));
    expect(telechargerPdf).toHaveBeenCalledWith("/espace/messagerie/messages/20/accuse/pdf", "Accuse-lecture-20.pdf");
    expect(screen.getByText(/responsable du traitement/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/chiffr|certifi|valeur probatoire/i);
  });

  it("demande une attestation", async () => {
    R.demanderAttestation.mockResolvedValue({ id: 2 });
    wrap(<EspaceMessagerie />);
    await userEvent.click(await screen.findByRole("button", { name: /Demander une attestation/ }));
    await userEvent.selectOptions(screen.getByLabelText("Type d'attestation"), "NON_REDEVANCE");
    await userEvent.click(screen.getByRole("button", { name: "Envoyer la demande" }));
    expect(R.demanderAttestation).toHaveBeenCalledWith("NON_REDEVANCE", "");
  });

  it("ouvre le composeur prérempli quand on arrive depuis Contacter", async () => {
    R.getEspaceAnnuaire.mockResolvedValue([{ id: 5, nom: "MABIALA Paul", cabinet: "Cabinet X" }]);
    wrap(<EspaceMessagerie />, { pathname: "/messagerie", state: { destinataireMembreId: 5 } });
    const select = await screen.findByLabelText("Confrère destinataire");
    await waitFor(() => expect(select).toHaveValue("5"));
  });
});

describe("EspaceAnnuaire — Contacter", () => {
  it("navigue vers la messagerie avec le destinataire prérempli", async () => {
    R.getEspaceAnnuaire.mockResolvedValue([{ id: 5, nom: "MABIALA Paul", qualite: "avocat", cabinet: "Cabinet X", numInscription: "A-5" }]);
    let lieu;
    const Spy = () => { lieu = useLocation(); return null; };
    render(
      <MemoryRouter initialEntries={["/annuaire"]}><ToastProvider>
        <Routes><Route path="/annuaire" element={<EspaceAnnuaire />} /><Route path="/messagerie" element={<Spy />} /></Routes>
      </ToastProvider></MemoryRouter>
    );
    await userEvent.click(await screen.findByRole("button", { name: "Contacter Me MABIALA Paul" }));
    expect(lieu.pathname).toBe("/messagerie");
    expect(lieu.state).toEqual({ destinataireMembreId: 5 });
  });
});
