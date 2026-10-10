import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { rafraichirIdentite, MENTION_DEMONSTRATION } from "../src/lib/identiteDocuments.js";
import { recuRicheHtml, quitusRicheHtml } from "../src/lib/documentsRiches.js";
import { tableauOrdreHtml, attestationHtml, listeAvocatsHtml } from "../src/lib/templates.js";

// X-05 / CA11 : reçus, quitus et tableau suivent l'identité paramétrée du barreau.
const LOGO = "data:image/png;base64,iVBORw0KGgo=";
const membre = { nom: "TEST IDENTITE", num: 1, dateInscription: new Date("2020-01-01") };
const recu = { numero: "R-1", montant: 50000, annee: 2026, date: new Date("2026-03-01") };
const quitus = { numero: "Q-1", annee: 2026, dateEmission: new Date("2026-03-01") };
const rendus = () => [
  recuRicheHtml(recu, membre, "data:,", "http://x"),
  quitusRicheHtml(quitus, membre, "data:,", "http://x"),
  attestationHtml(membre, "ATT-1", new Date("2026-03-01")),
  tableauOrdreHtml([{ qualite: "AVOCAT", membres: [] }], new Date("2026-03-01")),
  listeAvocatsHtml([], "tous", new Date("2026-03-01")),
];
const lire = async () => ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? {}) as Record<string, unknown>;
const ecrire = async (identite: Record<string, unknown>) => {
  const data = { ...(await lire()), identite } as never;
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data }, create: { id: 1, data } });
  await rafraichirIdentite();
};
let avant: unknown;

beforeAll(async () => { avant = (await lire()).identite; });
afterAll(async () => {
  const data = { ...(await lire()), identite: avant } as never;
  await prisma.parametres.update({ where: { id: 1 }, data: { data } });
  await rafraichirIdentite();
});

describe("Identité paramétrée des documents (X-05)", () => {
  it("reprend dénomination, ville et logo, sans « Pointe-Noire »", async () => {
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", logo: LOGO, modeDemonstration: false, adresse: "Adresse démo" });
    for (const h of rendus()) {
      expect(h).not.toContain("Pointe-Noire");
      expect(h).not.toContain("pointe-noire");
      expect(h).toContain(LOGO);
    }
    const [r, q] = rendus();
    expect(r).toContain("Brazzaville, le");
    expect(r).toContain("au Barreau de démonstration");
    expect(q).toContain("Brazzaville, le");
    expect(q).toContain("BARREAU DE DÉMONSTRATION");
  });

  it("la mention C-13 n'apparaît qu'en mode démonstration", async () => {
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", modeDemonstration: true });
    for (const h of rendus()) expect(h).toContain(MENTION_DEMONSTRATION);
    await ecrire({ denomination: "Barreau de démonstration", ville: "Brazzaville", modeDemonstration: false });
    for (const h of rendus()) expect(h).not.toContain(MENTION_DEMONSTRATION);
  });

  it("aucune mention de TVA sur le reçu et le quitus", () => {
    const [r, q] = rendus();
    expect(r + q).not.toMatch(/TVA/);
  });
});
