// Clé de TEST uniquement (32 octets à zéro, en base64) : jamais une clé réelle.
process.env.PARAMS_CLE = Buffer.alloc(32).toString("base64");
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { chiffrer, dechiffrer, masquer } from "../src/lib/secrets.js";

/** T13 — secrets des paramètres chiffrés au repos, jamais renvoyés en clair, sections sensibles cloisonnées. */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const login = async (email: string) =>
  (await request(app).post("/api/auth/login").send({ email, password: "barreau" })).body.token as string;
const CLE_TEST = process.env.PARAMS_CLE;
const SECRET = "secret-tres-confidentiel-9876";
let sg = "", bat = "", treso = "", admin = "";
let sauvegarde: unknown = null;

beforeAll(async () => {
  [sg, bat, treso, admin] = await Promise.all(
    ["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "tresoriere@barreau-pn.cg", "admin@barreau-pn.cg"].map(login),
  );
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
});
afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
});
afterEach(() => {
  process.env.PARAMS_CLE = CLE_TEST;
  vi.restoreAllMocks();
});

const put = (jeton: string, corps: object) => request(app).put("/api/parametres").set(...bearer(jeton)).send(corps);
const get = (jeton: string) => request(app).get("/api/parametres").set(...bearer(jeton));
const stocke = async () => (await prisma.parametres.findUnique({ where: { id: 1 } }))!.data as Record<string, any>;

describe("lib/secrets", () => {
  it("chiffrer puis dechiffrer redonne la valeur ; format enc:v1", () => {
    const c = chiffrer(SECRET);
    expect(c.startsWith("enc:v1:")).toBe(true);
    expect(c).not.toContain(SECRET);
    expect(dechiffrer(c)).toBe(SECRET);
    expect(chiffrer(SECRET)).not.toBe(c); // IV aléatoire
  });
  it("un tag altéré lève une erreur", () => {
    const [p, v, iv, tag, ct] = chiffrer(SECRET).split(":");
    const tagAltere = Buffer.from(tag, "base64");
    tagAltere[0] ^= 1;
    expect(() => dechiffrer([p, v, iv, tagAltere.toString("base64"), ct].join(":"))).toThrow();
  });
  it("une valeur sans préfixe est renvoyée telle quelle (smtp.pass historique en clair)", () => {
    expect(dechiffrer("ancien-mot-de-passe")).toBe("ancien-mot-de-passe");
  });
  it("masquer ne laisse paraître que 4 caractères d'un secret long, aucun d'un secret court", () => {
    expect(masquer(chiffrer(SECRET))).toBe("••••9876");
    expect(masquer(chiffrer("court"))).toBe("••••");
    expect(masquer("")).toBe("");
  });
});

describe("PUT/GET /parametres — sections sensibles", () => {
  it("enregistre des secrets chiffrés en base et ne les renvoie jamais en clair (PUT ni GET, quel que soit le rôle)", async () => {
    const r = await put(sg, {
      passerelles: { mode: "TEST", mtn: { actif: true, apiUser: "user-mtn", abonnementCle: SECRET, cleSecrete: SECRET } },
      notifications: { sms: { actif: true, url: "https://sms.exemple.cg/api", expediteur: "BARREAU", cleApi: SECRET } },
      smtp: { host: "127.0.0.1", port: 1025, secure: false, user: "u", pass: SECRET, from: "test@barreau-pn.cg" },
      messagerie: { interneActive: true, piecesJointes: true, pieceMaxMo: 5, relaisEmail: true, relaisSms: false },
    });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toContain(SECRET);
    expect(JSON.stringify(r.body)).not.toContain("enc:");
    const d = await stocke();
    expect(d.smtp.pass.startsWith("enc:v1:")).toBe(true);
    expect(d.passerelles.mtn.cleSecrete.startsWith("enc:v1:")).toBe(true);
    expect(d.notifications.sms.cleApi.startsWith("enc:v1:")).toBe(true);
    for (const jeton of [sg, bat, treso, admin]) {
      const g = await get(jeton);
      expect(g.status).toBe(200);
      const json = JSON.stringify(g.body);
      expect(json).not.toContain(SECRET);
      expect(json).not.toContain("enc:");
    }
    expect((await get(sg)).body.smtp.pass).toBe("••••9876");
  });

  it("un rôle sans permission parametres ne reçoit ni passerelles, ni notifications, ni smtp, ni messagerie", async () => {
    for (const jeton of [treso, bat]) {
      const b = (await get(jeton)).body;
      for (const k of ["passerelles", "notifications", "smtp", "messagerie"]) expect(b).not.toHaveProperty(k);
      expect(b).toHaveProperty("tarifs");
    }
    const b = (await get(sg)).body;
    for (const k of ["passerelles", "notifications", "smtp", "messagerie"]) expect(b).toHaveProperty(k);
  });

  it("un historique smtp.pass en clair n'est jamais renvoyé (faille corrigée)", async () => {
    const d = await stocke();
    await prisma.parametres.update({ where: { id: 1 }, data: { data: { ...d, smtp: { ...d.smtp, pass: "mot-de-passe-en-clair-1234" } } } });
    for (const jeton of [sg, treso]) expect(JSON.stringify((await get(jeton)).body)).not.toContain("mot-de-passe-en-clair");
  });

  it("une valeur masquée ou vide conserve le secret existant ; une nouvelle valeur le remplace", async () => {
    await put(sg, { smtp: { pass: SECRET } });
    const avant = (await stocke()).smtp.pass;
    expect((await put(sg, { smtp: { pass: "••••9876", host: "127.0.0.1" } })).status).toBe(200);
    expect((await stocke()).smtp.pass).toBe(avant);
    expect((await put(sg, { smtp: { pass: "" } })).status).toBe(200);
    expect((await stocke()).smtp.pass).toBe(avant);
    expect((await put(sg, { smtp: { pass: "nouveau-secret-0000" } })).status).toBe(200);
    expect(dechiffrer((await stocke()).smtp.pass)).toBe("nouveau-secret-0000");
  });

  it("une mise à jour partielle d'une passerelle n'efface pas les autres champs", async () => {
    await put(sg, { passerelles: { airtel: { clientId: "client-airtel", cleSecrete: SECRET } } });
    await put(sg, { passerelles: { airtel: { actif: true } } });
    const d = await stocke();
    expect(d.passerelles.airtel.clientId).toBe("client-airtel");
    expect(dechiffrer(d.passerelles.airtel.cleSecrete)).toBe(SECRET);
    expect(d.passerelles.mtn.apiUser).toBe("user-mtn");
  });

  it("mode PRODUCTION → 400 (verrouillé sur TEST)", async () => {
    expect((await put(sg, { passerelles: { mode: "PRODUCTION" } })).status).toBe(400);
    expect((await put(sg, { passerelles: { mtn: { environnement: "production" } } })).status).toBe(400);
  });

  it("secret sans PARAMS_CLE → 400 avec message explicite", async () => {
    delete process.env.PARAMS_CLE;
    const r = await put(sg, { passerelles: { agregateur: { cleApi: "x-nouvelle-cle-1111" } } });
    expect(r.status).toBe(400);
    expect(r.body.erreur).toMatch(/PARAMS_CLE/);
  });

  it("pieceMaxMo > 5 → 400", async () => {
    expect((await put(sg, { messagerie: { pieceMaxMo: 6 } })).status).toBe(400);
  });

  it("masquer /parametres, la Discipline, le Journal d'audit, le Tableau ou l'accueil est refusé ; un autre module est accepté", async () => {
    for (const p of ["/", "/parametres", "/discipline", "/journal-audit", "/tableau"]) {
      expect((await put(sg, { modules: { masques: [p] } })).status, p).toBe(400);
    }
    expect((await put(sg, { modules: { masques: ["/archives"] } })).status).toBe(200);
    expect((await stocke()).modules.masques).toEqual(["/archives"]);
  });

  it("un rôle sans permission parametres ne peut pas écrire une section sensible", async () => {
    expect((await put(bat, { smtp: { host: "mail.exemple.cg" } })).status).toBe(403);
  });
});

describe("POST /parametres/tester/:canal", () => {
  it("mtn : simulation de complétude, sans aucun appel réseau, journalisée sans secret", async () => {
    const espion = vi.spyOn(globalThis, "fetch");
    const r = await request(app).post("/api/parametres/tester/mtn").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.simulation).toBe(true);
    expect(r.body.message).toMatch(/simulation : configuration complète/);
    expect(espion).not.toHaveBeenCalled();
    await new Promise((res) => setTimeout(res, 300)); // journal écrit après la réponse
    const ligne = await prisma.journalAudit.findFirst({ where: { chemin: "/api/parametres/tester/mtn" }, orderBy: { id: "desc" } });
    expect(ligne).not.toBeNull();
    expect(JSON.stringify(ligne)).not.toContain(SECRET);
  });

  it("agregateur incomplet : liste des champs manquants", async () => {
    const d = await stocke();
    await prisma.parametres.update({ where: { id: 1 }, data: { data: { ...d, passerelles: { mode: "TEST" } } } });
    const r = await request(app).post("/api/parametres/tester/agregateur").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.manquants).toEqual(expect.arrayContaining(["siteId", "cleApi"]));
  });

  it("smtp : verify() sur le Mailpit du socle (127.0.0.1:1025), aucun envoi", async () => {
    await put(sg, { smtp: { host: "127.0.0.1", port: 1025, secure: false, user: "", from: "test@barreau-pn.cg" } });
    const r = await request(app).post("/api/parametres/tester/smtp").set(...bearer(sg));
    expect(r.status).toBe(200);
    expect(r.body.simulation).toBe(false);
    expect(r.body.ok).toBe(true);
  });

  it("canal inconnu → 400 ; trésorière → 403", async () => {
    expect((await request(app).post("/api/parametres/tester/inconnu").set(...bearer(sg))).status).toBe(400);
    expect((await request(app).post("/api/parametres/tester/mtn").set(...bearer(treso))).status).toBe(403);
  });
});
