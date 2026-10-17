import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { synchroniserAccesAuStatut } from "../src/lib/acces.js";

/**
 * T12 (M-20261016) — routes /espace en lecture cloisonnée qui comblent les manques de
 * l'audit docs/audits/m20261016/espace-avocat.md :
 *  - E2 GET /espace/parcours (nouvelle) : historique des situations et stage, du seul jeton ;
 *  - E1 GET /espace/moi enrichi de l'étape de recouvrement de l'exercice ;
 *  - E7 GET /espace/discipline(/:id) en projection, décision servie une fois notifiée ;
 *  - E7 bis décision PDF : 404 tant que la décision n'est pas notifiée ;
 *  - E6 GET /auth/identite : liste des modules masqués (filtre du menu de l'espace).
 * Aucun motif médical (R-15 : code d'article seul), aucune pièce d'instruction, aucun
 * compte désactivé (radié, décédé) réouvert.
 */
const app = creerApp();
const MARQUE = "E2E T12";
const SUFFIXE = `${Date.now()}`;
const emailDe = (x: string) => `e2e-t12-${x}-${SUFFIXE}@test.cg`;
const get = (url: string, jeton?: string) => {
  const r = request(app).get(url);
  return jeton ? r.set("Authorization", `Bearer ${jeton}`) : r;
};
const login = async (email: string) => {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  if (!r.body.token) throw new Error(`Connexion impossible pour ${email} (${r.status})`);
  return r.body.token as string;
};

const m = { A: 0, B: 0, S: 0 };
const j = { A: "", B: "", S: "", sg: "" };
const fx = { evtB: 0, evtInstruction: 0, dossierNonNotifie: 0, dossierNotifie: 0, dossierB: 0 };
const annee = new Date().getFullYear();
const DETAIL_MEDICAL = "pathologie détaillée confidentielle";

beforeAll(async () => {
  const hash = bcrypt.hashSync("barreau", 4);
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  const membre = async (i: number, cle: string, data: Record<string, unknown>) =>
    (await prisma.membre.create({ data: { num: num + i, nom: `${MARQUE} ${cle} ${SUFFIXE}`, qualite: "AVOCAT", statut: "INSCRIT", ...data } })).id;
  m.A = await membre(0, "A", {});
  m.B = await membre(1, "B", {});
  m.S = await membre(2, "S", { qualite: "STAGIAIRE", statut: "STAGIAIRE", dateServment: new Date("2025-11-03"), dureeMois: 24, maitreStage: `${MARQUE} Maître` });
  for (const [k, id] of Object.entries(m))
    await prisma.user.create({ data: { nom: `${MARQUE} ${k}`, email: emailDe(k), role: "AVOCAT", passwordHash: hash, actif: true, membreId: id } });
  [j.A, j.B, j.S, j.sg] = await Promise.all([login(emailDe("A")), login(emailDe("B")), login(emailDe("S")), login("sg@barreau-pn.cg")]);

  const dossier = (membreId: number, x: string, data: Record<string, unknown> = {}) =>
    prisma.dossierDisciplinaire.create({
      data: {
        reference: `E2E-T12-D-${x}-${SUFFIXE}`, avocatNom: MARQUE, objet: `${MARQUE} objet`, dateSaisine: new Date("2026-03-01"), membreId,
        plaignant: "Plaignant secret", rapporteur: "Rapporteur secret", conclusionRapport: "Conclusion secrète", orientation: "POURSUITE",
        pieces: ["piece-instruction.pdf"], motivation: "Motivation interne", decision: "Blâme", sanction: "Blâme", ...data,
      },
    });
  fx.dossierNonNotifie = (await dossier(m.A, "NN")).id;
  fx.dossierNotifie = (await dossier(m.A, "N", { dateDecision: new Date("2026-04-01"), dateNotification: new Date("2026-04-05"), decidePar: "Conseil de discipline" })).id;
  fx.dossierB = (await dossier(m.B, "B", { dateNotification: new Date("2026-04-05") })).id;

  const evt = (membreId: number, data: Record<string, unknown>) =>
    prisma.evenementSituation.create({ data: { membreId, statutAvant: "INSCRIT", statutApres: "INSCRIT", dateEffet: new Date("2026-02-01"), acteurId: 1, acteurNom: "Acteur interne", details: { interne: true }, ...data } as never });
  await evt(m.A, { type: "RAPPEL", annee, dateEffet: new Date(`${annee}-01-05`) });
  await evt(m.A, { type: "MISE_EN_DEMEURE", annee, dateEffet: new Date(`${annee}-02-10`) });
  // Omission pour maladie : même si un motif détaillé a été saisi par le passé, seul le code d'article sort.
  await evt(m.A, { type: "OMISSION", statutApres: "OMIS", annee: 2024, dateEffet: new Date("2024-03-20"), reference: "CNO-2024-1", motif: `Art. 35-1° loi n° 026-92 — ${DETAIL_MEDICAL}`, details: { cause: "35-1", organe: "CNO" } });
  await evt(m.A, { type: "REINSCRIPTION", statutAvant: "OMIS", annee: 2024, dateEffet: new Date("2024-09-01"), reference: "CNO-2024-2" });
  fx.evtInstruction = (await evt(m.A, { type: "SUSPENDU", dateEffet: new Date("2026-03-15"), motif: "Motif d'instruction", reference: "REF-INSTRUCTION", dossierId: fx.dossierNonNotifie })).id;
  fx.evtB = (await evt(m.B, { type: "RAPPEL", annee, motif: "Évènement de B" })).id;
}, 120_000);

afterAll(async () => {
  const ids = Object.values(m).filter(Boolean);
  await prisma.evenementSituation.deleteMany({ where: { membreId: { in: ids } } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { membreId: { in: ids } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-t12-", endsWith: `-${SUFFIXE}@test.cg` } } });
  await prisma.membre.deleteMany({ where: { id: { in: ids } } });
  expect(await prisma.membre.count({ where: { id: { in: ids } } })).toBe(0);
}, 120_000);

describe("E2 — GET /api/espace/parcours", () => {
  it("401 sans jeton, 403 pour un rôle non AVOCAT", async () => {
    expect((await get("/api/espace/parcours")).status).toBe(401);
    expect((await get("/api/espace/parcours", j.sg)).status).toBe(403);
  });

  it("200 pour l'avocat : ses seuls événements, en projection, du plus récent au plus ancien", async () => {
    const r = await get("/api/espace/parcours", j.A);
    expect(r.status).toBe(200);
    const ev = r.body.evenements as Record<string, unknown>[];
    expect(ev.length).toBe(5);
    expect(ev.map((e) => e.id)).not.toContain(fx.evtB);
    const dates = ev.map((e) => String(e.dateEffet));
    expect([...dates].sort().reverse()).toEqual(dates);
    for (const e of ev) expect(Object.keys(e).sort()).toEqual(["annee", "dateEffet", "id", "motif", "reference", "statutApres", "statutAvant", "type"]);
    expect(JSON.stringify(r.body)).not.toMatch(/Acteur interne|interne|Évènement de B/);
    expect(r.body.stage).toBeNull();
  });

  it("le jeton d'un autre avocat ne voit pas les événements de A (aucune fuite)", async () => {
    const r = await get("/api/espace/parcours", j.B);
    expect(r.status).toBe(200);
    expect((r.body.evenements as { id: number }[]).map((e) => e.id)).toEqual([fx.evtB]);
  });

  it("omission pour maladie : code d'article seul, aucun motif médical", async () => {
    const r = await get("/api/espace/parcours", j.A);
    const om = (r.body.evenements as Record<string, unknown>[]).find((e) => e.type === "OMISSION")!;
    expect(om.motif).toBe("Art. 35-1° loi n° 026-92");
    expect(JSON.stringify(r.body)).not.toContain(DETAIL_MEDICAL);
  });

  it("événement lié à une décision non notifiée : motif et référence masqués", async () => {
    const r = await get("/api/espace/parcours", j.A);
    const e = (r.body.evenements as Record<string, unknown>[]).find((x) => x.id === fx.evtInstruction)!;
    expect(e.motif).toBeNull();
    expect(e.reference).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(/Motif d'instruction|REF-INSTRUCTION/);
  });

  it("stagiaire : bloc stage (date de serment, durée, maître, fin prévue)", async () => {
    const r = await get("/api/espace/parcours", j.S);
    expect(r.status).toBe(200);
    expect(r.body.stage).toEqual({ dateServment: "2025-11-03", dureeMois: 24, maitreStage: `${MARQUE} Maître`, finPrevue: "2027-11-03", stageValideAt: null });
  });

  it("compte désactivé par un statut bloquant (radié) : 401, aucune session rouverte", async () => {
    await synchroniserAccesAuStatut(m.B, "RADIE");
    try {
      expect((await get("/api/espace/parcours", j.B)).status).toBe(401);
    } finally {
      await synchroniserAccesAuStatut(m.B, "INSCRIT");
    }
  });
});

describe("E1 — GET /api/espace/moi : étape de recouvrement de l'exercice", () => {
  it("renvoie la dernière étape (type, date) de l'exercice courant", async () => {
    const r = await get("/api/espace/moi", j.A);
    expect(r.status).toBe(200);
    expect(r.body.recouvrement).toEqual({ type: "MISE_EN_DEMEURE", dateEffet: `${annee}-02-10` });
  });
  it("null sans étape", async () => {
    expect((await get("/api/espace/moi", j.S)).body.recouvrement).toBeNull();
  });
});

describe("E7 — discipline en projection, décision servie une fois notifiée", () => {
  const INTERDITS = /Plaignant secret|Rapporteur secret|Conclusion secrète|POURSUITE|piece-instruction|Motivation interne/;

  it("401 sans jeton, 403 pour un rôle non AVOCAT", async () => {
    expect((await get("/api/espace/discipline")).status).toBe(401);
    expect((await get("/api/espace/discipline", j.sg)).status).toBe(403);
    expect((await get(`/api/espace/discipline/${fx.dossierNotifie}`, j.sg)).status).toBe(403);
  });

  it("liste : aucun élément d'instruction, décision absente si non notifiée", async () => {
    const r = await get("/api/espace/discipline", j.A);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(INTERDITS);
    const nn = r.body.find((d: { id: number }) => d.id === fx.dossierNonNotifie);
    const n = r.body.find((d: { id: number }) => d.id === fx.dossierNotifie);
    expect(nn.decision).toBeUndefined();
    expect(nn.sanction).toBeUndefined();
    expect(n.decision).toBe("Blâme");
    expect(n.dateNotification).toBeTruthy();
    expect(r.body.map((d: { id: number }) => d.id)).not.toContain(fx.dossierB);
  });

  it("détail : même projection ; dossier d'un autre avocat 404", async () => {
    const nn = await get(`/api/espace/discipline/${fx.dossierNonNotifie}`, j.A);
    expect(nn.status).toBe(200);
    expect(JSON.stringify(nn.body)).not.toMatch(INTERDITS);
    expect(nn.body.decision).toBeUndefined();
    expect(nn.body.reference).toBe(`E2E-T12-D-NN-${SUFFIXE}`);
    const n = await get(`/api/espace/discipline/${fx.dossierNotifie}`, j.A);
    expect(n.body).toMatchObject({ decision: "Blâme", sanction: "Blâme", sursis: false, decidePar: "Conseil de discipline" });
    expect(JSON.stringify(n.body)).not.toMatch(INTERDITS);
    expect((await get(`/api/espace/discipline/${fx.dossierB}`, j.A)).status).toBe(404);
    expect((await get(`/api/espace/discipline/${fx.dossierNotifie}`, j.B)).status).toBe(404);
  });

  it("décision PDF : 404 tant que non notifiée, 404 pour un autre avocat", async () => {
    expect((await get(`/api/espace/discipline/${fx.dossierNonNotifie}/decision/pdf`, j.A)).status).toBe(404);
    expect((await get(`/api/espace/discipline/${fx.dossierNotifie}/decision/pdf`, j.B)).status).toBe(404);
  });
});

describe("E6 — GET /api/auth/identite : modules masqués", () => {
  it("expose la seule liste des chemins masqués, sans changer les clés d'identité", async () => {
    const r = await get("/api/auth/identite");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.modules.masques)).toBe(true);
    expect(Object.keys(r.body.modules)).toEqual(["masques"]);
    expect(Object.keys(r.body.identite).sort()).toEqual(["denomination", "logo", "modeDemonstration", "ordre", "ville"]);
  });
});
