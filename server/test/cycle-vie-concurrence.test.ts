import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/prisma.js";
import { changerSituation } from "../src/lib/cycleVie.js";

/**
 * R1-11 (revue) — changerSituation sérialise les transitions d'un même membre :
 * - deux changements concurrents s'enchaînent dans l'historique (statutAvant du second =
 *   statutApres du premier) et l'état final est celui du dernier événement ;
 * - l'accès à l'espace avocat est écrit dans la même transaction que la transition :
 *   il ne peut pas contredire le statut final ;
 * - réconciliation : tout passage par changerSituation recale l'accès, même sans changement de statut.
 */
const marque = `R111-${Date.now()}`;
const membres: number[] = [];

async function membreAvecCompte(suffixe: string, actif = true) {
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 970000) + 1;
  const m = await prisma.membre.create({ data: { num, nom: `${marque} ${suffixe}`, qualite: "AVOCAT", statut: "INSCRIT" } });
  membres.push(m.id);
  const u = await prisma.user.create({ data: { nom: m.nom, email: `${marque.toLowerCase()}-${suffixe}@test.cg`, role: "AVOCAT", passwordHash: "x", actif, membreId: m.id } });
  return { m, u };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { membreId: { in: membres } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
});

describe("R1-11 — transitions concurrentes sérialisées", () => {
  it("historique chaîné, statut final = dernier événement, accès cohérent", async () => {
    for (let i = 0; i < 5; i++) {
      const { m, u } = await membreAvecCompte(`c${i}`);
      await Promise.all([
        changerSituation({ membreId: m.id, type: "SUSPENSION", demande: { statut: "SUSPENDU" } }),
        changerSituation({ membreId: m.id, type: "RADIATION", demande: { statut: "RADIE", dateRadiation: new Date(), motifRadiation: "test" } }),
        changerSituation({ membreId: m.id, type: "REPRISE", demande: { statut: "INSCRIT" } }),
      ]);
      const evts = await prisma.evenementSituation.findMany({ where: { membreId: m.id }, orderBy: { id: "asc" } });
      expect(evts).toHaveLength(3);
      expect(evts[0].statutAvant).toBe("INSCRIT");
      for (let k = 1; k < evts.length; k++) expect(evts[k].statutAvant).toBe(evts[k - 1].statutApres);
      const fin = await prisma.membre.findUniqueOrThrow({ where: { id: m.id } });
      expect(fin.statut).toBe(evts[2].statutApres);
      const compte = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(compte.actif).toBe(fin.statut === "INSCRIT");
    }
  });

  it("réconciliation : un accès resté actif sur une fiche radiée est coupé au passage suivant", async () => {
    const { m, u } = await membreAvecCompte("reco");
    await prisma.membre.update({ where: { id: m.id }, data: { statut: "RADIE", dateRadiation: new Date(), motifRadiation: "test" } });
    // Écart simulé : l'accès n'a pas suivi (échec antérieur hors transaction).
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).actif).toBe(true);
    await changerSituation({ membreId: m.id, type: "SANCTION", motif: "mention sans effet sur le statut" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).actif).toBe(false);
  });
});
