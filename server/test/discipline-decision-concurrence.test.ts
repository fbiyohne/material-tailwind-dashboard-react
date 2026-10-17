import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R1-6 (revue) — POST /discipline/:id/decision est atomique et protégé contre la concurrence :
 * - deux soumissions simultanées (double clic, deux onglets) : un 200, un 409, un seul événement ;
 * - si l'effet échoue (radiation d'un avocat décédé), rien n'est écrit sur le dossier.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) => (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const marque = `R16-${Date.now()}`;
let sg = "", bat = "";
const membres: number[] = [];
const dossiers: number[] = [];

const preparer = async (nom: string) => {
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${marque} ${nom}`, qualite: "AVOCAT" });
  expect(m.status).toBe(201);
  membres.push(m.body.id);
  const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: `Me ${marque}`, objet: "Manquement", membreId: m.body.id });
  expect(d.status).toBe(201);
  dossiers.push(d.body.id);
  return { membreId: m.body.id as number, id: d.body.id as number };
};
const decider = (id: number, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/decision`).set(...bearer(bat)).send({ motivation: "Motivation suffisante de la décision du conseil.", ...corps });

beforeAll(async () => { [sg, bat] = await Promise.all([login("sg@barreau-pn.cg"), login("batonnier@barreau-pn.cg")]); });
afterAll(async () => {
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
});

describe("R1-6 — décision disciplinaire atomique", () => {
  it("deux POST /decision simultanés : un 200, un 409, un seul événement", async () => {
    const { membreId, id } = await preparer("Concurrence");
    const corps = { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3 };
    const statuts = (await Promise.all([decider(id, corps), decider(id, corps)])).map((r) => r.status).sort();
    expect(statuts).toEqual([200, 409]);
    expect(await prisma.evenementSituation.count({ where: { membreId, dossierId: id } })).toBe(1);
  });

  it("effet refusé (radiation d'un décédé) : 409 et dossier sans décision, resoumission possible", async () => {
    const { membreId, id } = await preparer("Decede");
    expect((await request(app).post(`/api/membres/${membreId}/deces`).set(...bearer(sg)).send({ dateDeces: "2026-01-02", piece: "Acte de décès n° 1" })).status).toBe(200);
    expect((await decider(id, { sanctionCode: "RADIATION" })).status).toBe(409);
    const d = await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id } });
    expect(d.sanctionCode).toBeNull();
    expect(d.statut).not.toBe("DECISION");
    expect((await decider(id, { sanctionCode: "AVERTISSEMENT" })).status).toBe(200);
  });
});

/**
 * R2-9 (revue) — le dossier est réaffecté à un autre avocat entre la lecture de la route et
 * l'écriture de la décision : la réservation est conditionnée au membreId lu, donc 409 et rien
 * n'est écrit (ni décision, ni événement, ni changement de statut sur l'un ou l'autre avocat).
 */
describe("R2-9 — dossier réaffecté pendant l'enregistrement de la décision", () => {
  it("réaffectation concurrente : 409, ancien et nouvel avocat intacts, dossier libre", async () => {
    const { membreId: ancien, id } = await preparer("Ancien");
    const { membreId: nouveau } = await preparer("Nouveau");
    let reponse!: Promise<request.Response>;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DossierDisciplinaire" WHERE id = ${id} FOR UPDATE`;
      reponse = decider(id, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3 }).then((x) => x);
      for (let i = 0; i < 100; i++) {
        const [{ n }] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))`;
        if (n > 0) break;
        await new Promise((r) => setTimeout(r, 50));
        if (i === 99) throw new Error("la requête n'a pas atteint le verrou du dossier");
      }
      await tx.dossierDisciplinaire.update({ where: { id }, data: { membreId: nouveau } });
    }, { timeout: 15000 });
    const r = await reponse;
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    const d = await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id } });
    expect(d.membreId).toBe(nouveau);
    expect(d.sanctionCode).toBeNull();
    for (const m of [ancien, nouveau]) {
      expect((await prisma.membre.findUniqueOrThrow({ where: { id: m } })).statut).toBe("INSCRIT");
      expect(await prisma.evenementSituation.count({ where: { membreId: m, dossierId: id } })).toBe(0);
    }
    // Le dossier reste disponible pour le nouvel avocat.
    expect((await decider(id, { sanctionCode: "AVERTISSEMENT" })).status).toBe(200);
    expect(await prisma.evenementSituation.count({ where: { membreId: nouveau, dossierId: id } })).toBe(1);
  });
});
