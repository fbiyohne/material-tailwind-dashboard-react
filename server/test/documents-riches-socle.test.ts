import { describe, it, expect } from "vitest";
import { quitusRicheHtml, recuRicheHtml } from "../src/lib/documentsRiches.js";
import { CLAUSE_VERIF } from "../src/lib/gabarit.js";
import { cheminVerif } from "../src/lib/signature.js";
import { fmtDateFr, fmtFCFA } from "../src/lib/documentsCommun.js";
import { montantEnLettresFCFA } from "../src/lib/montantEnLettres.js";

/**
 * Quitus et reçu sur le socle A4 (M-20261016, T5) : mise en page seule.
 * La chaîne QR reçue des routes est placée telle quelle, la clause CL-VERIF mot pour mot,
 * le numéro, la date et le montant d'une pièce déjà émise sont reproduits à l'identique.
 */
const QR = "data:image/png;base64,QRDEMO+/=0123456789abcdef";
const membre = { nom: "DUPONT Jean", num: 7, dateInscription: new Date("2020-01-01"), cabinet: "Cabinet Dupont", adresse: "Av. Test" };
const quitus = { numero: "Q-2026-0042", annee: 2026, dateEmission: new Date("2026-10-11T10:00:00Z"), finValidite: new Date("2027-01-11T10:00:00Z") };
const recu = { numero: "R-2026-0187", montant: 175000, annee: 2026, date: new Date("2026-10-11T10:00:00Z"), mode: "Espèces", objet: "Cotisation ordinale 2026" };
const q = () => quitusRicheHtml(quitus, membre, QR, "barreau.exemple.cg");
const r = () => recuRicheHtml(recu, membre, QR, "barreau.exemple.cg");
// Termes interdits HJ-6 (clauses-congres.md) ; data URI retirées (base64 fortuit).
const HJ6 = /certifié|signature électronique|horodatage qualifié|recommandé électronique|chiffré de bout en bout|vote vérifiable|secret garanti/i;
const sansDataUri = (h: string) => h.replace(/data:[^"')]+/g, "");

describe("Quitus et reçu sur le socle A4 (T5)", () => {
  it("sont assemblés par pageA4 : A4, pagination, une page, sans mise à l'échelle", () => {
    for (const h of [q(), r()]) {
      expect(h).toContain('"Page " counter(page) "/" counter(pages)');
      expect(h).toContain('class="une-page"');
      expect(h).toContain('class="cloture"');
      expect(h).not.toMatch(/doc-root|scale\(|size: A4 portrait; margin: 0/);
    }
  });

  it("placent la chaîne QR reçue à l'identique et la clause CL-VERIF mot pour mot", () => {
    for (const h of [q(), r()]) {
      expect(h).toContain(`<img src="${QR}"`);
      expect(h).toContain(CLAUSE_VERIF);
    }
    expect(q()).toContain(`barreau.exemple.cg${cheminVerif("q", quitus.numero)}`);
    expect(r()).toContain(`barreau.exemple.cg${cheminVerif("r", recu.numero)}`);
  });

  it("quitus : numéro, date d'émission et fin de validité figée reproduits", () => {
    const h = q();
    expect(h).toContain(quitus.numero);
    expect(h).toContain(fmtDateFr(quitus.dateEmission));
    expect(h).toContain(`Valable jusqu'au <b>${fmtDateFr(quitus.finValidite)}</b> inclus, sauf changement de situation du titulaire`);
    expect(h).toContain("Me DUPONT Jean");
    expect(h).toContain("Cabinet Dupont — Av. Test");
    expect(h).toContain("est à jour de toutes ses cotisations, contributions et redevances");
    expect(h).toContain("En foi de quoi, le présent quitus lui est délivré pour servir et valoir ce que de droit.");
  });

  it("reçu : numéro, date, montant en chiffres et en lettres reproduits", () => {
    const h = r();
    expect(h).toContain(recu.numero);
    expect(h).toContain(fmtDateFr(recu.date));
    expect(h).toContain(fmtFCFA(175000));
    expect(h.toLowerCase()).toContain(montantEnLettresFCFA(175000).toLowerCase());
    expect(h).toContain("Reconnaît avoir reçu de Maître :");
    expect(h).toContain("En foi de quoi, le présent reçu lui est délivré pour servir et valoir ce que de droit.");
  });

  it("ne contiennent aucun terme interdit HJ-6", () => {
    for (const h of [q(), r()]) expect(sansDataUri(h)).not.toMatch(HJ6);
  });
});
