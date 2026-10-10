import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REGLES_DEFAUT } from "../src/lib/regles.js";
import { cotisationDue, tarifsActuels, eligibiliteElectorale } from "../src/lib/business.js";

/**
 * T12 — X-03 : corps électoral calculé à la date du scrutin (CA9), ?annee= conservé
 * (31/12 par défaut, même liste que la règle historique de 76958a4), éligibilité des
 * candidats paramétrable (CA8), type CONSEIL_BARREAU et vote de l'espace à la dateScrutin.
 * Sur 76958a4, ?date= est ignoré (les deux listes sont identiques), POST /scrutins refuse
 * CONSEIL_BARREAU et dateScrutin, et la candidature au bâtonnat n'est pas contrôlée.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const j = (iso: string) => new Date(`${iso}T12:00:00Z`);
const ANNEE = 2026;
const base = 985000 + (Date.now() % 1000) * 4;
const ids: Record<string, number> = {};
const scrutins: number[] = [];
let sg = "";
let sauvegarde: unknown = null;
let avocat = { token: "", membreId: 0 };

const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;

async function membre(cle: string, data: Record<string, unknown> = {}) {
  const num = base + Object.keys(ids).length;
  const m = await prisma.membre.create({ data: { num, nom: `X03 ${cle} ${num}`, qualite: "AVOCAT", statut: "INSCRIT", dateInscription: j("2015-01-10"), ...data } as never });
  ids[cle] = m.id;
  return m;
}

async function payer(membreId: number, date: string) {
  const montant = cotisationDue(null, await tarifsActuels(), "AVOCAT");
  const r = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee: ANNEE, montant, mode: "Espèces", date });
  expect(r.status).toBe(201);
}

const dossier = (cle: string, data: Record<string, unknown>) =>
  prisma.dossierDisciplinaire.create({
    data: { reference: `X03-${base}-${cle}`, membreId: ids[cle], avocatNom: `X03 ${cle}`, objet: "Test X-03", dateSaisine: j("2026-01-05"), statut: "DECISION", ...data } as never,
  });

const corps = (q: string) => request(app).get(`/api/corps-electoral?${q}`).set(...bearer(sg));
const idsDe = (liste: { id: number }[]) => new Set(liste.map((x) => x.id));
const creerScrutin = async (data: Record<string, unknown>) => {
  const r = await request(app).post("/api/scrutins").set(...bearer(sg)).send({ modalite: "PRESENTIEL", nbSieges: 1, ...data });
  if (r.status === 201) scrutins.push(r.body.id);
  return r;
};
const candidater = (sid: number, body: Record<string, unknown>) =>
  request(app).post(`/api/scrutins/${sid}/candidats`).set(...bearer(sg)).send(body);

beforeAll(async () => {
  sg = await login("sg@barreau-pn.cg");
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;

  // A : paie sa cotisation le 10 mai ; B : à jour depuis janvier, interdiction ferme du 1er juin au 1er septembre.
  await membre("A");
  await payer(ids.A, "2026-05-10");
  await membre("B");
  await payer(ids.B, "2026-01-15");
  await dossier("B", { sanctionCode: "INTERDICTION_TEMPORAIRE", sanction: "Interdiction temporaire (3 mois)", sursis: false, sanctionDebut: j("2026-06-01"), sanctionFin: j("2026-09-01"), dateDecision: j("2026-05-20") });
  // C stagiaire, D omis, E honoraire : jamais électeurs (règles par défaut).
  await membre("C", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
  await membre("D", { statut: "OMIS" });
  await payer(ids.D, "2026-01-15");
  await membre("E", { qualite: "HONORAIRE" });
  // F : exactement 8 ans d'inscription au 15/12/2026 ; G : peine accessoire de 24 mois depuis janvier 2026.
  await membre("F", { dateInscription: j("2018-12-15") });
  await membre("G");
  await dossier("G", { sanctionCode: "AVERTISSEMENT", sanction: "Avertissement", peineAccessoireMois: 24, dateDecision: j("2026-01-10") });

  // H : avocat avec accès à l'espace, cotisation payée le 10 mai.
  const email = `x03.${base}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `X03 H ${base}`, qualite: "AVOCAT", email });
  ids.H = m.body.id;
  await prisma.membre.update({ where: { id: ids.H }, data: { dateInscription: j("2015-01-10") } });
  const prov = await request(app).post(`/api/membres/${ids.H}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  avocat = { token, membreId: ids.H };
  await payer(ids.H, "2026-05-10");
});

afterAll(async () => {
  const membreIds = Object.values(ids);
  if (scrutins.length) await prisma.scrutin.deleteMany({ where: { id: { in: scrutins } } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { reference: { startsWith: `X03-${base}-` } } });
  await prisma.recu.deleteMany({ where: { membreId: { in: membreIds } } });
  await prisma.membre.deleteMany({ where: { id: { in: membreIds } } });
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
});

describe("GET /corps-electoral?date= — situation à la date (X-03, CA9)", () => {
  it("deux dates encadrant un paiement donnent deux listes différentes", async () => {
    const avant = await corps("date=2026-04-30");
    const apres = await corps("date=2026-07-15");
    expect(avant.status).toBe(200);
    expect(apres.status).toBe(200);
    expect(idsDe(avant.body.electeurs).has(ids.A)).toBe(false);
    expect(idsDe(avant.body.exclusCotisation).has(ids.A)).toBe(true);
    expect(idsDe(apres.body.electeurs).has(ids.A)).toBe(true);
    expect(apres.body.date).toMatch(/^2026-07-15/);
  });

  it("deux dates encadrant une interdiction temporaire donnent deux listes différentes", async () => {
    const avant = await corps("date=2026-05-15");
    const pendant = await corps("date=2026-07-15");
    expect(idsDe(avant.body.electeurs).has(ids.B)).toBe(true);
    expect(idsDe(pendant.body.electeurs).has(ids.B)).toBe(false);
    expect(idsDe(pendant.body.exclusStatut).has(ids.B)).toBe(true);
  });

  it("stagiaires, omis, honoraires et statuts hors tableau sont exclus", async () => {
    const r = await corps("date=2026-12-31");
    const electeurs = idsDe(r.body.electeurs);
    for (const cle of ["C", "D", "E"]) expect(electeurs.has(ids[cle])).toBe(false);
    expect(idsDe(r.body.exclusStatut).has(ids.D)).toBe(true);
    expect(idsDe(r.body.exclusAutre).has(ids.E)).toBe(true);
  });

  it("?annee= est conservé : 31/12 par défaut, même liste que la règle historique", async () => {
    const parAnnee = await corps(`annee=${ANNEE}`);
    const parDate = await corps(`date=${ANNEE}-12-31`);
    expect(parAnnee.status).toBe(200);
    expect(parAnnee.body.annee).toBe(ANNEE);
    expect(idsDe(parAnnee.body.electeurs)).toEqual(idsDe(parDate.body.electeurs));
    // Référence 76958a4 : eligibiliteElectorale(membre, ligne de cotisation de l'exercice, tarifs).
    const tarifs = await tarifsActuels();
    const electeurs = idsDe(parAnnee.body.electeurs);
    for (const cle of ["A", "B", "D", "E", "F", "G"]) {
      const m = await prisma.membre.findUniqueOrThrow({ where: { id: ids[cle] }, include: { cotisations: { where: { annee: ANNEE } } } });
      expect(electeurs.has(m.id), cle).toBe(eligibiliteElectorale(m, m.cotisations[0] ?? null, tarifs).eligible);
    }
  });

  it("refuse une date invalide (400)", async () => {
    expect((await corps("date=hier")).status).toBe(400);
    expect((await corps("date=2026-13-45")).status).toBe(400);
    // scrutinId mal formé : 400 (jamais 500), scrutin inexistant : 404.
    expect((await corps("scrutinId=abc")).status).toBe(400);
    expect((await corps("scrutinId=999999999")).status).toBe(404);
  });
});

describe("Scrutins — CONSEIL_BARREAU, dateScrutin et éligibilité des candidats (CA8)", () => {
  it("crée un scrutin du Conseil du barreau daté", async () => {
    const r = await creerScrutin({ titre: `Conseil du barreau ${base}`, type: "CONSEIL_BARREAU", dateScrutin: "2026-12-15" });
    expect(r.status).toBe(201);
    expect(r.body.type).toBe("CONSEIL_BARREAU");
    expect(r.body.dateScrutin).toMatch(/^2026-12-15/);
  });

  it("bâtonnat : exactement 8 ans → 409 motivé ; 8 ans et 1 jour → 201 ; seuil modifiable en Paramètres", async () => {
    const s = await creerScrutin({ titre: `Bâtonnier ${base}`, type: "BATONNIER", dateScrutin: "2026-12-15" });
    const sid = s.body.id as number;
    const refus = await candidater(sid, { nom: "X03 F", membreId: ids.F });
    expect(refus.status).toBe(409);
    expect(refus.body.message ?? refus.body.error ?? JSON.stringify(refus.body)).toMatch(/ancienneté/i);

    await prisma.membre.update({ where: { id: ids.F }, data: { dateInscription: j("2018-12-14") } });
    expect((await candidater(sid, { nom: "X03 F", membreId: ids.F })).status).toBe(201);

    // CA8 : le seuil passe à 10 ans en Paramètres → la même candidature est refusée, sans redémarrage.
    const { stage: _s, ...regles } = structuredClone(REGLES_DEFAUT);
    regles.eligibilite.BATONNIER.ancienneteMinAns = 10;
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ regles })).status).toBe(200);
    expect((await candidater(sid, { nom: "X03 F bis", membreId: ids.F })).status).toBe(409);
    regles.eligibilite.BATONNIER.ancienneteMinAns = 8;
    await request(app).put("/api/parametres").set(...bearer(sg)).send({ regles });

    // Sans fiche rattachée (candidat libre), le contrôle ne s'applique pas : comportement historique.
    expect((await candidater(sid, { nom: "Me Candidat libre" })).status).toBe(201);
  });

  it("une peine accessoire d'inéligibilité en cours refuse la candidature (409)", async () => {
    const s = await creerScrutin({ titre: `Conseil ${base}`, type: "CONSEIL", dateScrutin: "2026-12-15" });
    const r = await candidater(s.body.id, { nom: "X03 G", membreId: ids.G });
    expect(r.status).toBe(409);
    expect(JSON.stringify(r.body)).toMatch(/peine accessoire/i);
  });
});

describe("Espace avocat — le vote s'apprécie à la dateScrutin", () => {
  it("non électeur à une dateScrutin antérieure au paiement, électeur à une date postérieure", async () => {
    const ouvrir = async (dateScrutin: string) => {
      const s = await creerScrutin({ titre: `En ligne ${dateScrutin} ${base}`, type: "CONSEIL", modalite: "EN_LIGNE", dateScrutin });
      const c = await candidater(s.body.id, { nom: "Me Candidat en ligne" });
      expect((await request(app).post(`/api/scrutins/${s.body.id}/ouvrir`).set(...bearer(sg))).status).toBe(200);
      return { sid: s.body.id as number, cid: c.body.id as number };
    };
    const tot = await ouvrir("2026-04-01");
    const tard = await ouvrir("2026-06-01");
    const liste = await request(app).get("/api/espace/scrutins").set(...bearer(avocat.token));
    expect(liste.status).toBe(200);
    expect(liste.body.find((x: { id: number }) => x.id === tot.sid).eligible).toBe(false);
    expect(liste.body.find((x: { id: number }) => x.id === tard.sid).eligible).toBe(true);
    expect((await request(app).post(`/api/espace/scrutins/${tot.sid}/voter`).set(...bearer(avocat.token)).send({ candidatIds: [tot.cid] })).status).toBe(403);
    expect((await request(app).post(`/api/espace/scrutins/${tard.sid}/voter`).set(...bearer(avocat.token)).send({ candidatIds: [tard.cid] })).status).toBe(201);
  });
});
