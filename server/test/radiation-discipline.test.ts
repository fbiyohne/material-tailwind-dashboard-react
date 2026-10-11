import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REGLES_SECTION_DEFAUT } from "../src/lib/regles.js";

/**
 * T5 (M-20261011, O2) — la radiation ne se décide que dans le module disciplinaire :
 * - décision RADIATION (effet à l'enregistrement) → RADIE, EvenementSituation rattaché au
 *   dossier (organe, date, référence), ligne JournalAudit ;
 * - effetRadiation = EXPIRATION_RECOURS : aucun effet immédiat, puis exécution par
 *   POST /membres/:id/radier (discipline_decider) rattachée au dossier ;
 * - décision réformée (opposition, appel) : retour en arrière tracé par un événement
 *   REFORMATION qui rétablit le statut antérieur, sans effacer aucun événement.
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string, password = "barreau") =>
  (await request(app).post("/api/auth/login").send({ email, password })).body.token as string;
const marque = `T5-${Date.now()}`;

let sg = "", bat = "";
let sauvegarde: unknown = null;
const membres: number[] = [];
const dossiers: number[] = [];

const creerMembre = async (nom: string) => {
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${marque} ${nom}`, qualite: "AVOCAT" });
  expect(m.status).toBe(201);
  membres.push(m.body.id);
  return m.body.id as number;
};
const ouvrir = async (membreId: number) => {
  const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ avocatNom: `Me ${marque}`, objet: "Manquement grave", membreId });
  expect(d.status).toBe(201);
  dossiers.push(d.body.id);
  return d.body.id as number;
};
const decider = (id: number, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/decision`).set(...bearer(bat)).send({ motivation: "Motivation suffisante de la décision du conseil de discipline.", ...corps });
const reformer = (id: number, jeton: string, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/reformation`).set(...bearer(jeton)).send(corps);
const radier = (membreId: number, jeton: string, corps: Record<string, unknown>) =>
  request(app).post(`/api/membres/${membreId}/radier`).set(...bearer(jeton)).send(corps);
const statutDe = async (membreId: number) => (await prisma.membre.findUniqueOrThrow({ where: { id: membreId } })).statut;
const evenements = (membreId: number) => prisma.evenementSituation.findMany({ where: { membreId }, orderBy: { id: "asc" } });
const putRegles = async (regles: Record<string, unknown>) => {
  const r = await request(app).put("/api/parametres").set(...bearer(bat)).send({ regles: { ...REGLES_SECTION_DEFAUT, ...regles } });
  expect(r.status).toBe(200);
};
/** L'audit est écrit après l'envoi de la réponse : on attend la ligne quelques instants. */
const ligneAudit = async (chemin: string, depuis: number) => {
  for (let i = 0; i < 40; i++) {
    const e = await prisma.journalAudit.findFirst({ where: { id: { gt: depuis }, chemin, methode: "POST" } });
    if (e) return e;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
};
const dernierAudit = async () => (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;

beforeAll(async () => {
  [sg, bat] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg"].map((e) => login(e)));
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
});

afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } }); // EvenementSituation : cascade
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
});

describe("Radiation décidée au module disciplinaire, effet à l'enregistrement", () => {
  it("décision RADIATION → RADIE, événement rattaché au dossier avec référence, ligne JournalAudit", async () => {
    await putRegles({ effetRadiation: "ENREGISTREMENT" });
    const membreId = await creerMembre("Radié immédiat");
    const id = await ouvrir(membreId);
    const depuis = await dernierAudit();
    const r = await decider(id, { sanctionCode: "RADIATION", reference: "CD-T5-01", dateDecision: "2026-05-02" });
    expect(r.status).toBe(200);
    expect(await statutDe(membreId)).toBe("RADIE");
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, type: "RADIATION" } });
    expect(evt).toMatchObject({ dossierId: id, reference: "CD-T5-01", statutAvant: "INSCRIT", statutApres: "RADIE" });
    expect(evt!.dateEffet.toISOString().slice(0, 10)).toBe("2026-05-02");
    expect((evt!.details as { decidePar?: string }).decidePar).toMatch(/conseil de discipline/i);
    expect(await ligneAudit(`/api/discipline/${id}/decision`, depuis)).not.toBeNull();
  });
});

describe("Radiation en mode EXPIRATION_RECOURS : exécution par /radier", () => {
  it("aucun effet immédiat, puis /radier (discipline_decider) rattaché au dossier → RADIE avec événement", async () => {
    await putRegles({ effetRadiation: "EXPIRATION_RECOURS" });
    const membreId = await creerMembre("Radié après recours");
    const id = await ouvrir(membreId);
    expect((await decider(id, { sanctionCode: "RADIATION", reference: "CD-T5-02" })).status).toBe(200);
    expect(await statutDe(membreId)).toBe("INSCRIT");
    expect(await prisma.evenementSituation.count({ where: { membreId, type: "RADIATION" } })).toBe(0);

    // Le SG instruit mais n'exécute pas la radiation.
    expect((await radier(membreId, sg, { dossierId: id, dateRadiation: "2026-06-01" })).status).toBe(403);
    // Un dossier d'un autre avocat ne peut pas fonder la radiation.
    const autre = await creerMembre("Autre avocat");
    expect((await radier(autre, bat, { dossierId: id, dateRadiation: "2026-06-01" })).status).toBe(400);
    expect(await statutDe(autre)).toBe("INSCRIT");

    const depuis = await dernierAudit();
    const r = await radier(membreId, bat, { dossierId: id, dateRadiation: "2026-06-01" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("RADIE");
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, type: "RADIATION" } });
    expect(evt).toMatchObject({ dossierId: id, reference: "CD-T5-02", statutAvant: "INSCRIT", statutApres: "RADIE" });
    expect(evt!.dateEffet.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(await ligneAudit(`/api/membres/${membreId}/radier`, depuis)).not.toBeNull();
  });

  it("/radier refuse un dossier sans décision de radiation", async () => {
    await putRegles({ effetRadiation: "EXPIRATION_RECOURS" });
    const membreId = await creerMembre("Averti");
    const id = await ouvrir(membreId);
    expect((await decider(id, { sanctionCode: "AVERTISSEMENT" })).status).toBe(200);
    expect((await radier(membreId, bat, { dossierId: id })).status).toBe(409);
    expect(await statutDe(membreId)).toBe("INSCRIT");
  });
});

describe("Décision réformée : retour en arrière tracé, jamais un effacement", () => {
  it("la réformation rétablit le statut antérieur et conserve les deux événements", async () => {
    await putRegles({ effetRadiation: "ENREGISTREMENT" });
    const membreId = await creerMembre("Radiation réformée");
    const id = await ouvrir(membreId);
    expect((await decider(id, { sanctionCode: "RADIATION", reference: "CD-T5-03" })).status).toBe(200);
    expect(await statutDe(membreId)).toBe("RADIE");
    const avant = await evenements(membreId);

    expect((await reformer(id, sg, { voie: "APPEL", reference: "CA-PN-2026-12" })).status).toBe(403);
    expect((await reformer(id, bat, { voie: "APPEL" })).status).toBe(400); // référence obligatoire
    expect((await reformer(id, bat, { voie: "AUTRE", reference: "X" })).status).toBe(400);

    const depuis = await dernierAudit();
    const r = await reformer(id, bat, { voie: "APPEL", reference: "CA-PN-2026-12", dateEffet: "2026-07-01" });
    expect(r.status).toBe(200);
    expect(await statutDe(membreId)).toBe("INSCRIT");

    const apres = await evenements(membreId);
    expect(apres.length).toBe(avant.length + 1);
    // Aucun événement supprimé ni modifié.
    expect(apres.slice(0, avant.length)).toEqual(avant);
    expect(apres.filter((e) => e.type === "RADIATION")).toHaveLength(1);
    expect(apres.at(-1)).toMatchObject({ type: "REFORMATION", dossierId: id, reference: "CA-PN-2026-12", statutAvant: "RADIE", statutApres: "INSCRIT" });
    expect(await ligneAudit(`/api/discipline/${id}/reformation`, depuis)).not.toBeNull();
    // La décision du dossier n'est pas effacée ; le recours est consigné.
    const d = await prisma.dossierDisciplinaire.findUniqueOrThrow({ where: { id } });
    expect(d.sanctionCode).toBe("RADIATION");
    expect(d.recours).toMatch(/CA-PN-2026-12/);

    // Une seule réformation par dossier.
    expect((await reformer(id, bat, { voie: "APPEL", reference: "CA-PN-2026-13" })).status).toBe(409);
  });

  it("réformée avant exécution (EXPIRATION_RECOURS) : tracée sans changer le statut, /radier ensuite refusé", async () => {
    await putRegles({ effetRadiation: "EXPIRATION_RECOURS" });
    const membreId = await creerMembre("Réformée avant exécution");
    const id = await ouvrir(membreId);
    expect((await decider(id, { sanctionCode: "RADIATION", reference: "CD-T5-04" })).status).toBe(200);
    const r = await reformer(id, bat, { voie: "OPPOSITION", reference: "OPP-2026-02" });
    expect(r.status).toBe(200);
    expect(await statutDe(membreId)).toBe("INSCRIT");
    const evt = await prisma.evenementSituation.findFirst({ where: { membreId, type: "REFORMATION" } });
    expect(evt).toMatchObject({ dossierId: id, statutAvant: "INSCRIT", statutApres: "INSCRIT" });
    expect((await radier(membreId, bat, { dossierId: id })).status).toBe(409);
    expect(await statutDe(membreId)).toBe("INSCRIT");
  });

  it("refusée sur un dossier sans décision de radiation", async () => {
    const membreId = await creerMembre("Réprimandé");
    const id = await ouvrir(membreId);
    expect((await decider(id, { sanctionCode: "REPRIMANDE" })).status).toBe(200);
    expect((await reformer(id, bat, { voie: "APPEL", reference: "CA-1" })).status).toBe(409);
  });
});
