import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { changerSituation } from "../src/lib/cycleVie.js";

/**
 * R1-11 (revue) — changerSituation sérialise les transitions d'un même membre :
 * - deux changements concurrents s'enchaînent dans l'historique (statutAvant du second =
 *   statutApres du premier) et l'état final est celui du dernier événement ;
 * - l'accès à l'espace avocat est écrit dans la même transaction que la transition :
 *   il ne peut pas contredire le statut final ;
 * - réconciliation restrictive : sans changement de statut, un passage ne fait que couper un
 *   accès resté ouvert sur un statut bloquant ; il ne réactive jamais un compte (désactivation
 *   manuelle par l'administrateur respectée) ;
 * - les gardes de PATCH /membres/:id, /radier et /deces sont réévaluées sous verrou : une
 *   transition concurrente intervenue entre la lecture et l'écriture donne 409, sans écrasement.
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

  it("non-régression QA : un compte désactivé par l'administrateur reste inactif après une sanction sans effet sur le statut", async () => {
    const { m, u } = await membreAvecCompte("desactive", false);
    await changerSituation({ membreId: m.id, type: "SANCTION", motif: "avertissement" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).actif).toBe(false);
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

// ── Gardes réévaluées sous verrou (TOCTOU de PATCH et /radier) ───────────────────────────────
const app = creerApp();
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
let sg = "", bat = "";
beforeAll(async () => {
  [sg, bat] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg"].map(login));
});

/**
 * Tient la fiche verrouillée (FOR UPDATE) dans une transaction ouverte, lance la requête,
 * attend qu'elle soit bloquée par cette transaction (pg_blocking_pids), puis radie la fiche et valide : la requête a donc
 * lu l'ancien statut avant la radiation et écrit après elle (course rendue déterministe).
 */
async function radiationPendant(membreId: number, lancer: () => Promise<request.Response>) {
  let reponse!: Promise<request.Response>;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Membre" WHERE id = ${membreId} FOR UPDATE`;
    reponse = lancer().then((x) => x); // supertest n'envoie la requête qu'à l'appel de then
    for (let i = 0; i < 100; i++) {
      const [{ n }] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))`;
      if (n > 0) break;
      await new Promise((r) => setTimeout(r, 50));
      if (i === 99) throw new Error("la requête n'a pas atteint le verrou");
    }
    await tx.membre.update({ where: { id: membreId }, data: { statut: "RADIE", dateRadiation: new Date(), motifRadiation: "radiation concurrente" } });
    await tx.user.updateMany({ where: { membreId }, data: { actif: false } });
  }, { timeout: 15000 });
  return reponse;
}

describe("R1-11 — gardes de PATCH et /radier sous verrou", () => {
  it("PATCH sans changement de statut concurrent d'une radiation : 409, la radiation et la coupure d'accès tiennent", async () => {
    const { m, u } = await membreAvecCompte("patch");
    const r = await radiationPendant(m.id, () =>
      request(app).patch(`/api/membres/${m.id}`).set("Authorization", `Bearer ${sg}`).send({ statut: "INSCRIT", tel: "060000001" })
    );
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    const fin = await prisma.membre.findUniqueOrThrow({ where: { id: m.id } });
    expect(fin.statut).toBe("RADIE");
    expect(fin.tel).not.toBe("060000001");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).actif).toBe(false);
  });

  it("PATCH avec changement de statut concurrent d'une radiation : 409, aucun événement", async () => {
    const { m } = await membreAvecCompte("patch2");
    const r = await radiationPendant(m.id, () =>
      request(app).patch(`/api/membres/${m.id}`).set("Authorization", `Bearer ${sg}`).send({ statut: "HONORAIRE" })
    );
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect((await prisma.membre.findUniqueOrThrow({ where: { id: m.id } })).statut).toBe("RADIE");
    expect(await prisma.evenementSituation.count({ where: { membreId: m.id } })).toBe(0);
  });

  it("/radier concurrent d'une radiation : 409 « déjà radié », aucun second événement", async () => {
    const { m } = await membreAvecCompte("radier");
    const r = await radiationPendant(m.id, () =>
      request(app).post(`/api/membres/${m.id}/radier`).set("Authorization", `Bearer ${bat}`).send({ dateRadiation: "2026-10-01", motifRadiation: "Décision n° R111" })
    );
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(await prisma.evenementSituation.count({ where: { membreId: m.id } })).toBe(0);
  });
});
