import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { rafraichirIdentite, identite } from "../src/lib/identiteDocuments.js";
import { recuRicheHtml } from "../src/lib/documentsRiches.js";
import { attestationHtml } from "../src/lib/templates.js";

/**
 * T30 (revue sécurité) : le logo, désormais servi aussi par la route publique
 * GET /auth/identite, est inséré tel quel dans `<img src="…">` des gabarits PDF.
 * Un guillemet dans la data URI sortait de l'attribut (injection HTML rendue par
 * Chromium). Seule une data URI image en base64 stricte est retenue, sinon le sceau.
 */
const lire = async () => ((await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? {}) as Record<string, unknown>;
const ecrireLogo = async (logo: string) => {
  const d = await lire();
  const data = { ...d, identite: { ...((d.identite as object) ?? {}), logo } } as never;
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

const membre = { nom: "TEST LOGO", num: 1, dateInscription: new Date("2020-01-01") };

describe("Logo de l'identité : aucune sortie d'attribut (T30)", () => {
  it("refuse une data URI qui contient un guillemet ou n'est pas en base64", async () => {
    await ecrireLogo('data:image/png;base64,AAAA" onerror="alert(1)');
    expect(identite().logo).toBe("");
    const html = attestationHtml(membre, "ATT-1", new Date("2026-03-01")) + recuRicheHtml({ numero: "R-1", montant: 1, annee: 2026, date: new Date() }, membre, "data:,", "http://x");
    expect(html).not.toContain("onerror");
  });

  it("conserve une data URI image base64 valide", async () => {
    const logo = "data:image/png;base64,iVBORw0KGgo=";
    await ecrireLogo(logo);
    expect(identite().logo).toBe(logo);
  });
});
