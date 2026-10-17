import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { reglesActuelles, REGLES_DEFAUT } from "../src/lib/regles.js";
import { identite, rafraichirIdentite } from "../src/lib/identiteDocuments.js";

// Règles juridiques paramétrables (T4, base de CA8) et identité du barreau (ville,
// mode démonstration). Les Paramètres modifiés sont restaurés en afterAll.
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let admin = "";
let sauvegarde: unknown = null;

beforeAll(async () => {
  const login = async (email: string) =>
    (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
  sg = await login("sg@barreau-pn.cg");
  admin = await login("admin@barreau-pn.cg");
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
});

afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
  await rafraichirIdentite();
});

describe("Règles juridiques — valeurs par défaut (loi n° 026-92)", () => {
  it("reprennent le référentiel : peines de l'art. 36, délais, stage, éligibilité", () => {
    expect(REGLES_DEFAUT.sanctions.map((s) => s.code)).toEqual(["AVERTISSEMENT", "REPRIMANDE", "INTERDICTION_TEMPORAIRE", "RADIATION"]);
    const it = REGLES_DEFAUT.sanctions.find((s) => s.code === "INTERDICTION_TEMPORAIRE")!;
    expect(it.dureeMaxMois).toBe(12);
    expect(it.sursisPossible).toBe(true);
    expect(REGLES_DEFAUT.impayes).toEqual({ delaiRappelJours: 30, delaiMiseEnDemeureJours: 15 });
    expect(REGLES_DEFAUT.stage).toEqual({ dureeMois: 24, certificatObligatoire: false });
    expect(REGLES_DEFAUT.eligibilite.BATONNIER).toEqual({ ancienneteMinAns: 8, stricte: true });
    expect(REGLES_DEFAUT.eligibilite.CONSEIL.ancienneteMinAns).toBe(0);
    expect(REGLES_DEFAUT.eligibilite.CONSEIL_BARREAU.ancienneteMinAns).toBe(0);
    expect(REGLES_DEFAUT.admissionDirecte.cas.map((c) => c.code)).toEqual(["MAGISTRAT", "ENSEIGNANT_DROIT", "NOTAIRE"]);
  });

  it("GET /parametres expose les règles et la ville par défaut", async () => {
    const r = await request(app).get("/api/parametres").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.regles.sanctions).toHaveLength(4);
    expect(r.body.regles.stage).toBeUndefined(); // la durée du stage reste sous la clé « stage »
    expect(r.body.stage.certificatObligatoire).toBe(false);
  });
});

describe("Règles juridiques — modification sans redémarrage (CA8)", () => {
  it("un PUT de stage.dureeMois est relu aussitôt par reglesActuelles()", async () => {
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ stage: { dureeMois: 30 } })).status).toBe(200);
    expect((await reglesActuelles()).stage.dureeMois).toBe(30);
    // La modification partielle d'une clé du stage ne fait pas perdre l'autre.
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ stage: { certificatObligatoire: true } })).status).toBe(200);
    expect((await reglesActuelles()).stage).toEqual({ dureeMois: 30, certificatObligatoire: true });
  });

  it("un PUT de la section regles complète change le catalogue et l'éligibilité", async () => {
    const { stage: _s, ...regles } = structuredClone(REGLES_DEFAUT);
    regles.sanctions[2].dureeMaxMois = 6;
    regles.eligibilite.BATONNIER.ancienneteMinAns = 10;
    const put = await request(app).put("/api/parametres").set(...bearer(admin)).send({ regles });
    expect(put.status).toBe(200);
    const r = await reglesActuelles();
    expect(r.sanctions[2].dureeMaxMois).toBe(6);
    expect(r.eligibilite.BATONNIER.ancienneteMinAns).toBe(10);
  });

  it("reglesActuelles() complète clé par clé une section regles ancienne ou incomplète", async () => {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = { ...(row!.data as object), regles: { impayes: { delaiRappelJours: 45 } } };
    await prisma.parametres.update({ where: { id: 1 }, data: { data } });
    const r = await reglesActuelles();
    expect(r.impayes).toEqual({ delaiRappelJours: 45, delaiMiseEnDemeureJours: 15 });
    expect(r.sanctions).toEqual(REGLES_DEFAUT.sanctions);
  });
});

describe("Règles juridiques — validation (400)", () => {
  const { stage: _s, ...base } = REGLES_DEFAUT;
  const envoyer = (regles: unknown) => request(app).put("/api/parametres").set(...bearer(sg)).send({ regles });

  it("refuse une sanction sans code", async () => {
    const regles = structuredClone(base);
    delete (regles.sanctions[0] as { code?: string }).code;
    expect((await envoyer(regles)).status).toBe(400);
  });

  it("refuse une durée négative", async () => {
    const regles = structuredClone(base);
    regles.sanctions[2].dureeMaxMois = -1;
    expect((await envoyer(regles)).status).toBe(400);
    const r2 = structuredClone(base);
    r2.impayes.delaiRappelJours = -5;
    expect((await envoyer(r2)).status).toBe(400);
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ stage: { dureeMois: -1 } })).status).toBe(400);
  });

  it("exige l'objet regles complet", async () => {
    expect((await envoyer({ impayes: base.impayes })).status).toBe(400);
  });
});

describe("Identité du barreau — ville et mode démonstration", () => {
  it("ville par défaut « Pointe-Noire », mode démonstration désactivé", async () => {
    await rafraichirIdentite();
    expect(identite().ville).toBe("Pointe-Noire");
    expect(identite().modeDemonstration).toBe(false);
  });

  it("un PUT de la ville et du mode démonstration est exposé aux documents", async () => {
    const put = await request(app).put("/api/parametres").set(...bearer(sg))
      .send({ identite: { denomination: "Barreau de démonstration", ville: "Brazzaville", modeDemonstration: true } });
    expect(put.status).toBe(200);
    expect(identite().ville).toBe("Brazzaville");
    expect(identite().modeDemonstration).toBe(true);
    expect(identite().denomination).toBe("Barreau de démonstration");
    expect((await request(app).put("/api/parametres").set(...bearer(sg)).send({ identite: { modeDemonstration: "oui" } })).status).toBe(400);
  });
});

describe("Réinitialisation des données — JournalAudit conservé", () => {
  it("la transaction de réinitialisation ne supprime jamais le journal d'audit", async () => {
    // La transaction est interceptée : la réinitialisation réelle viderait la base de test.
    const tx = vi.spyOn(prisma, "$transaction").mockResolvedValueOnce([] as never);
    const purge = vi.spyOn(prisma.journalAudit, "deleteMany");
    const avant = await prisma.journalAudit.count();
    const r = await request(app).post("/api/parametres/reinitialiser-donnees").set(...bearer(admin));
    expect(r.status).toBe(200);
    expect(tx).toHaveBeenCalledTimes(1);
    expect(purge).not.toHaveBeenCalled();
    expect(await prisma.journalAudit.count()).toBeGreaterThanOrEqual(avant);
    tx.mockRestore();
    purge.mockRestore();
  });
});
