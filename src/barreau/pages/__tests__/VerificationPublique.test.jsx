import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationPublique } from "../VerificationPublique";

// T10 (avis juridique, point 6) : la page ne qualifie plus le contrôle de « signature
// électronique RSA » ; elle porte la clause CL-VERIF.
afterEach(() => vi.unstubAllGlobals());

describe("VerificationPublique — clause CL-VERIF", () => {
  it("affiche la clause CL-VERIF et aucune mention RSA", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ valide: true, type: "quitus", numero: "Q-2026-0001", date: "2026-10-01" }) }));
    const { container } = render(<VerificationPublique type="quitus" numero="Q-2026-0001" />);
    expect(await screen.findByText("Document authentique")).toBeInTheDocument();
    const texte = container.textContent;
    expect(texte).toContain("Ce code permet de contrôler que le document a été émis par l'Ordre et d'en connaître le statut actuel. Il ne constitue pas une signature électronique.");
    expect(texte).toContain("Authenticité vérifiable en scannant ce code ou sur ");
    expect(texte).not.toMatch(/RSA|SHA-256/);
  });
});

// R2-4 : l'ancienne voie /api/verifier renvoie `note` (libellé neutre) à la place de `beneficiaire`
// pour un titulaire sorti du tableau ; la page affiche alors la ligne « Titulaire » sans aucun nom.
const repondre = (corps) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => corps }));

describe("VerificationPublique — minimisation (R2-4)", () => {
  it("titulaire sorti : ligne « Titulaire » avec le libellé neutre, aucune ligne Bénéficiaire", async () => {
    repondre({ valide: true, type: "recu", numero: "R-2026-0001", note: "Le titulaire n'est pas inscrit au tableau à ce jour.", exercice: 2026, date: "01/01/2026" });
    render(<VerificationPublique type="recu" numero="R-2026-0001" />);
    expect(await screen.findByText("Titulaire")).toBeInTheDocument();
    expect(screen.getByText("Le titulaire n'est pas inscrit au tableau à ce jour.")).toBeInTheDocument();
    expect(screen.queryByText("Bénéficiaire")).toBeNull();
  });

  it("titulaire inscrit : ligne Bénéficiaire avec le nom, aucune ligne Titulaire", async () => {
    repondre({ valide: true, type: "quitus", numero: "Q-2026-0001", beneficiaire: "Me MOUKALA", exercice: 2026, date: "01/01/2026" });
    render(<VerificationPublique type="quitus" numero="Q-2026-0001" />);
    expect(await screen.findByText("Me MOUKALA")).toBeInTheDocument();
    expect(screen.getByText("Bénéficiaire")).toBeInTheDocument();
    expect(screen.queryByText("Titulaire")).toBeNull();
  });
});
