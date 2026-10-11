import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REGLES_SECTION_DEFAUT } from "../src/lib/regles.js";

/**
 * T11 (X-02, CA6, CA8, CA10) — décision disciplinaire enregistrée :
 * - seul le titulaire de l'action discipline_decider (bâtonnier par défaut) enregistre
 *   une décision (POST /decision) ou modifie decision / sanction / statut=DECISION (PATCH) ;
 * - la sanction est contrôlée contre le catalogue des règles (code, durée, sursis, motivation) ;
 * - effets : interdiction ferme → SUSPENDU ; avec sursis → reste INSCRIT au tableau ;
 *   radiation → RADIE, retiré du tableau et de l'annuaire sans autre saisie.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string, password = "barreau") =>
  (await request(app).post("/api/auth/login").send({ email, password })).body.token as string;
const marque = `T11-${Date.now()}`;

let sg = "", bat = "", admin = "";
let sauvegarde: unknown = null;
const membres: number[] = [];
const dossiers: number[] = [];
let avocat = { membreId: 0, userId: 0, token: "" };

const creerMembre = async (nom: string, email?: string) => {
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${marque} ${nom}`, qualite: "AVOCAT", email });
  expect(m.status).toBe(201);
  membres.push(m.body.id);
  return m.body.id as number;
};
const ouvrir = async (membreId: number | null, jeton = sg) => {
  const d = await request(app).post("/api/discipline").set(...bearer(jeton))
    .send({ avocatNom: `Me ${marque}`, objet: "Manquement déontologique", ...(membreId ? { membreId } : {}) });
  expect(d.status).toBe(201);
  dossiers.push(d.body.id);
  return d.body.id as number;
};
const decider = (id: number, jeton: string, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/decision`).set(...bearer(jeton)).send({ motivation: "Motivation suffisante de la décision du conseil de discipline.", ...corps });
const statutDe = async (membreId: number) => (await prisma.membre.findUniqueOrThrow({ where: { id: membreId } })).statut;
const auTableau = async (membreId: number) => {
  const t = await request(app).get("/api/tableau").set(...bearer(sg));
  expect(t.status).toBe(200);
  return t.body.sections.some((s: { membres: { id: number }[] }) => s.membres.some((m) => m.id === membreId));
};
const putRegles = async (regles: Record<string, unknown>) => {
  const r = await request(app).put("/api/parametres").set(...bearer(sg)).send({ regles: { ...REGLES_SECTION_DEFAUT, ...regles } });
  expect(r.status).toBe(200);
};

beforeAll(async () => {
  [sg, bat, admin] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "admin@barreau-pn.cg"].map((e) => login(e)));
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
  // Un avocat avec accès à l'espace, pour consulter l'annuaire.
  const email = `t11.${Date.now()}@barreau-pn.cg`;
  const id = await creerMembre("Lecteur annuaire", email);
  const prov = await request(app).post(`/api/membres/${id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  avocat = { membreId: id, token: await login(email, "avocatpass8"), userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id };
});

afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.user.deleteMany({ where: { id: avocat.userId } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } }); // EvenementSituation : cascade
});

describe("X-02 — seul le titulaire de discipline_decider enregistre la décision", () => {
  it("POST /decision : SG 403, BATONNIER 200 ; PATCH decision / statut=DECISION : SG 403", async () => {
    const membreId = await creerMembre("Avertissement");
    const id = await ouvrir(membreId);
    expect((await decider(id, sg, { sanctionCode: "AVERTISSEMENT" })).status).toBe(403);
    expect((await request(app).patch(`/api/discipline/${id}`).set(...bearer(sg)).send({ decision: "<p>Décision</p>" })).status).toBe(403);
    expect((await request(app).patch(`/api/discipline/${id}`).set(...bearer(sg)).send({ sanction: "Radiation" })).status).toBe(403);
    expect((await request(app).patch(`/api/discipline/${id}`).set(...bearer(sg)).send({ statut: "DECISION" })).status).toBe(403);
    // Le SG instruit toujours : rapporteur, recours, et renvoi à l'identique des champs de décision (formulaire existant).
    expect((await request(app).patch(`/api/discipline/${id}`).set(...bearer(sg)).send({ rapporteur: "Me Rapporteur", decision: "", sanction: "", statut: "INSTRUCTION" })).status).toBe(200);

    const r = await decider(id, bat, { sanctionCode: "AVERTISSEMENT", reference: "CD-2026-01" });
    expect(r.status).toBe(200);
    expect(r.body.sanctionCode).toBe("AVERTISSEMENT");
    expect(r.body.sanction).toBe("Avertissement");
    expect(r.body.statut).toBe("DECISION");
    expect(r.body.decidePar).toMatch(/conseil de discipline/i);
    expect(await statutDe(membreId)).toBe("INSCRIT");
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, dossierId: id } });
    expect(evt?.type).toBe("SANCTION");
    expect(evt?.statutApres).toBe("INSCRIT");
    // Une seule décision par dossier.
    expect((await decider(id, bat, { sanctionCode: "REPRIMANDE" })).status).toBe(409);
    // Le bâtonnier peut ensuite compléter le texte de la décision par PATCH.
    expect((await request(app).patch(`/api/discipline/${id}`).set(...bearer(bat)).send({ decision: "<p>Texte de la décision</p>" })).status).toBe(200);
  });

  it("POST /discipline : saisine par le SG et par le bâtonnier (discipline_saisir)", async () => {
    await ouvrir(null, sg);
    await ouvrir(null, bat);
  });
});

describe("Catalogue des sanctions (règles paramétrables, CA8)", () => {
  it("13 mois d'interdiction, code BLAME, sursis sur un avertissement, dossier sans membre : 400", async () => {
    const membreId = await creerMembre("Catalogue");
    const id = await ouvrir(membreId);
    expect((await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 13 })).status).toBe(400);
    expect((await decider(id, bat, { sanctionCode: "BLAME" })).status).toBe(400);
    expect((await decider(id, bat, { sanctionCode: "AVERTISSEMENT", sursis: true })).status).toBe(400);
    expect((await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE" })).status).toBe(400); // durée obligatoire
    expect((await decider(id, bat, { sanctionCode: "AVERTISSEMENT", motivation: "" })).status).toBe(400);
    const sansMembre = await ouvrir(null);
    expect((await decider(sansMembre, bat, { sanctionCode: "AVERTISSEMENT" })).status).toBe(400);
  });

  it("le catalogue modifié en Paramètres s'applique sans redéploiement", async () => {
    const membreId = await creerMembre("Catalogue modifié");
    const id = await ouvrir(membreId);
    const sanctions = REGLES_SECTION_DEFAUT.sanctions.map((s) => (s.code === "INTERDICTION_TEMPORAIRE" ? { ...s, dureeMaxMois: 24 } : s));
    await putRegles({ sanctions, sursisAutorise: false });
    expect((await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 13, sursis: true })).status).toBe(400); // sursis interdit
    const r = await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 13 });
    expect(r.status).toBe(200);
    expect(r.body.sanctionDureeMois).toBe(13);
    await putRegles({});
    expect(await statutDe(membreId)).toBe("SUSPENDU");
  });
});

describe("CA6 — effets de la décision sur la situation de l'avocat", () => {
  it("interdiction temporaire ferme : SUSPENDU, dates de début et de fin, événement SUSPENSION", async () => {
    const membreId = await creerMembre("Interdiction ferme");
    const id = await ouvrir(membreId);
    const r = await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 6, dateDecision: "2026-03-01", peineAccessoireMois: 12 });
    expect(r.status).toBe(200);
    expect(r.body.sanction).toBe("Interdiction temporaire (6 mois)");
    expect(r.body.sanctionDebut).toMatch(/^2026-03-01/);
    expect(r.body.sanctionFin).toMatch(/^2026-09-01/);
    expect(await statutDe(membreId)).toBe("SUSPENDU");
    expect(await auTableau(membreId)).toBe(true); // suspendu : au tableau, mention de statut
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, dossierId: id } });
    expect(evt?.type).toBe("SUSPENSION");
    expect(evt?.statutAvant).toBe("INSCRIT");
    expect(evt?.statutApres).toBe("SUSPENDU");
  });

  it("interdiction avec sursis : l'avocat reste INSCRIT, au tableau, avec la mention sur sa fiche", async () => {
    const membreId = await creerMembre("Sursis");
    const id = await ouvrir(membreId);
    const r = await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3, sursis: true });
    expect(r.status).toBe(200);
    expect(r.body.sursis).toBe(true);
    expect(r.body.sanction).toBe("Interdiction temporaire (3 mois, avec sursis)");
    expect(await statutDe(membreId)).toBe("INSCRIT");
    expect(await auTableau(membreId)).toBe(true);
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, dossierId: id } });
    expect(evt?.type).toBe("SANCTION");
    expect(evt?.motif).toContain("avec sursis");
  });

  it("radiation enregistrée : RADIE, retiré du tableau et de l'annuaire sans autre saisie", async () => {
    const membreId = await creerMembre("Radiation");
    const id = await ouvrir(membreId);
    expect(await auTableau(membreId)).toBe(true);
    const r = await decider(id, bat, { sanctionCode: "RADIATION", dateDecision: "2026-04-15", reference: "CD-2026-07" });
    expect(r.status).toBe(200);
    const m = await prisma.membre.findUniqueOrThrow({ where: { id: membreId } });
    expect(m.statut).toBe("RADIE");
    expect(m.dateRadiation?.toISOString()).toMatch(/^2026-04-15/);
    expect(m.motifRadiation).toContain("CD-2026-07");
    expect(await auTableau(membreId)).toBe(false);
    const annuaire = await request(app).get("/api/espace/annuaire").set(...bearer(avocat.token));
    expect(annuaire.status).toBe(200);
    expect(annuaire.body.some((x: { id: number }) => x.id === membreId)).toBe(false);
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, dossierId: id } });
    expect(evt?.type).toBe("RADIATION");
    expect(evt?.statutApres).toBe("RADIE");
  });

  it("radiation avec effetRadiation=EXPIRATION_RECOURS : enregistrée sans changement de statut", async () => {
    const membreId = await creerMembre("Radiation différée");
    const id = await ouvrir(membreId);
    await putRegles({ effetRadiation: "EXPIRATION_RECOURS" });
    const r = await decider(id, bat, { sanctionCode: "RADIATION" });
    await putRegles({});
    expect(r.status).toBe(200);
    expect(await statutDe(membreId)).toBe("INSCRIT");
    expect((await prisma.evenementSituation.findFirst({ where: { membreId, dossierId: id } }))?.type).toBe("SANCTION");
  });
});

describe("CA10 — la lecture d'un dossier disciplinaire est tracée dans JournalAudit", () => {
  it("GET /discipline/:id crée une ligne de consultation sans contenu", async () => {
    const id = await ouvrir(null);
    const avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
    expect((await request(app).get(`/api/discipline/${id}`).set(...bearer(bat))).status).toBe(200);
    let e = null;
    for (let i = 0; i < 30 && !e; i++) {
      e = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, chemin: `/api/discipline/${id}`, methode: "GET" } });
      if (!e) await new Promise((r) => setTimeout(r, 100));
    }
    expect(e).not.toBeNull();
    expect(e!.action).toContain("Consultation");
    expect(e!.action).not.toContain("Manquement");
  });
});

describe("R2-3 — interdiction ferme refusée pour un avocat omis ou sorti", () => {
  it.each(["OMIS", "DEMISSIONNAIRE"] as const)("%s : 409, fiche inchangée, aucun événement, dossier libre, absent du tableau", async (statut) => {
    const membreId = await creerMembre(`Hors tableau ${statut}`);
    const id = await ouvrir(membreId);
    await prisma.membre.update({ where: { id: membreId }, data: { statut } });
    const avant = await prisma.membre.findUniqueOrThrow({ where: { id: membreId } });
    const r = await decider(id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3 });
    expect(r.status).toBe(409);
    const apres = await prisma.membre.findUniqueOrThrow({ where: { id: membreId } });
    expect(apres.statut).toBe(statut);
    expect(apres.updatedAt.getTime()).toBe(avant.updatedAt.getTime());
    expect(await prisma.evenementSituation.count({ where: { membreId, dossierId: id } })).toBe(0);
    expect((await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id } })).sanctionCode).toBeNull();
    expect(await auTableau(membreId)).toBe(false);
  });
});
