import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R1-1 (revue, H13, D2, CA6) — les routes génériques du SG ne contournent plus la
 * séparation bâtonnier / SG :
 *  - PATCH /membres/:id : SUSPENDU → tableau pendant une interdiction ferme en cours, 403
 *    sans discipline_decider (ADMIN l'a) ; permis après sanctionFin ;
 *  - import : aucun changement de statut d'un membre existant vers ou depuis SUSPENDU,
 *    aucun stagiaire existant passé au tableau.
 * (OMIS par PATCH ou import, stagiaire par PATCH et REPRISE : r1-5-contournement et omission.test.)
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const marque = `E2E R11-${Date.now()}`;

let sg = "", admin = "";
let base = 0;
const membres: number[] = [];
const dossiers: number[] = [];

async function membre(cle: string, data: Record<string, unknown> = {}) {
  const num = base + membres.length;
  const m = await prisma.membre.create({ data: { num, numInscription: `R11-${num}`, nom: `${marque} ${cle}`, qualite: "AVOCAT", statut: "INSCRIT", ...data } as never });
  membres.push(m.id);
  return m;
}
async function interdiction(membreId: number, fin: Date, sursis = false) {
  const d = await prisma.dossierDisciplinaire.create({
    data: { reference: `${marque}-${membreId}-${dossiers.length}`, membreId, avocatNom: "R11", objet: "R11", dateSaisine: new Date("2026-01-05"), statut: "DECISION",
      sanctionCode: "INTERDICTION_TEMPORAIRE", sanction: "Interdiction temporaire", sursis, sanctionDebut: new Date("2026-01-10"), sanctionFin: fin } as never,
  });
  dossiers.push(d.id);
}
const patch = (jeton: string, id: number, corps: object) => request(app).patch(`/api/membres/${id}`).set(...bearer(jeton)).send(corps);
const lire = (id: number) => prisma.membre.findUniqueOrThrow({ where: { id } });
const futur = () => new Date(Date.now() + 90 * 86_400_000);

beforeAll(async () => {
  [sg, admin] = await Promise.all(["sg@barreau-pn.cg", "admin@barreau-pn.cg"].map(login));
  base = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 985000) + 1000;
});

afterAll(async () => {
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } }); // EvenementSituation : cascade
});

describe("R1-1 — PATCH /membres/:id, interdiction temporaire en cours", () => {
  it("SUSPENDU → INSCRIT : SG 403 et rien modifié ; fiche sans changement de statut 200 ; ADMIN 200", async () => {
    const m = await membre("susp", { statut: "SUSPENDU" });
    await interdiction(m.id, futur());
    const r = await patch(sg, m.id, { statut: "INSCRIT" });
    expect(r.status).toBe(403);
    expect(r.body.erreur).toMatch(/discipline_decider/);
    expect((await lire(m.id)).statut).toBe("SUSPENDU");
    expect(await prisma.evenementSituation.count({ where: { membreId: m.id } })).toBe(0);
    expect((await patch(sg, m.id, { statut: "SUSPENDU", cabinet: "Cabinet R11" })).status).toBe(200);
    expect((await patch(admin, m.id, { statut: "INSCRIT" })).status).toBe(200);
  });

  it("interdiction échue ou avec sursis : SG 200", async () => {
    const a = await membre("echue", { statut: "SUSPENDU" });
    await interdiction(a.id, new Date("2026-02-01"));
    expect((await patch(sg, a.id, { statut: "INSCRIT" })).status).toBe(200);
    const b = await membre("sursis", { statut: "SUSPENDU" });
    await interdiction(b.id, futur(), true);
    expect((await patch(sg, b.id, { statut: "INSCRIT" })).status).toBe(200);
  });
});

describe("R1-1 — POST /membres/import", () => {
  it("statut d'un membre existant vers ou depuis SUSPENDU : erreur de ligne, rien écrit (simulation comprise)", async () => {
    const a = await membre("imp-a");
    const b = await membre("imp-b", { statut: "SUSPENDU" });
    const lignes = [{ num: a.num, nom: a.nom, statut: "Suspendu" }, { num: b.num, nom: b.nom, statut: "Inscrit" }];
    for (const q of ["?simulation=1", ""]) {
      const r = await request(app).post(`/api/membres/import${q}`).set(...bearer(sg)).send({ membres: lignes });
      expect(r.status).toBe(200);
      expect(r.body.maj).toBe(0);
      expect(r.body.erreurs).toHaveLength(2);
    }
    expect([(await lire(a.id)).statut, (await lire(b.id)).statut]).toEqual(["INSCRIT", "SUSPENDU"]);
  });

  it("stagiaire existant importé comme avocat ou inscrit : erreur de ligne ; ré-import en stagiaire : 200", async () => {
    const s = await membre("imp-s", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    const imp = (ligne: object, qualiteDefaut?: string) =>
      request(app).post("/api/membres/import").set(...bearer(sg)).send({ membres: [{ num: s.num, nom: s.nom, ...ligne }], qualiteDefaut });
    expect((await imp({ qualite: "Avocat", statut: "Inscrit" })).body.erreurs).toHaveLength(1);
    expect((await imp({ qualite: "Stagiaire", statut: "Inscrit" })).body.erreurs).toHaveLength(1);
    expect((await imp({})).body.erreurs).toHaveLength(1); // qualité par défaut AVOCAT
    expect(await lire(s.id)).toMatchObject({ qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    const ok = await imp({ cabinet: "Cabinet R11" }, "STAGIAIRE");
    expect(ok.body).toMatchObject({ maj: 1, erreurs: [] });
  });
});
