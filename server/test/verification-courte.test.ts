import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { cheminVerif, urlVerif } from "../src/lib/signature.js";

/**
 * T10 (M-20261011, point 10) : page publique courte GET /v/{q|r|t}/{ref}.{jeton},
 * rendue côté serveur en HTML pur (sans JS ni cookie), minimale (avis juridique),
 * et bascule des anciennes URL /api/verifier/... sur la date VERIF_BASCULE.
 */
const app = creerApp();
let num = 0;
const membres: number[] = [];
const quitus: Record<string, string> = {};
let recu = "";
let recuRadie = "";
let timbre = "";
let timbreAnnule = "";
let numInscription = "";
const NOM = "VERIF <script>alert(1)</script>";
const basculeAvant = process.env.VERIF_BASCULE;

const altere = (chemin: string) => chemin.replace(/\.(.)/, (_m, c) => "." + (c === "A" ? "B" : "A"));

beforeAll(async () => {
  num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  numInscription = `INSC-V${num}`;
  const creer = async (statut: string, i: number) => {
    const m = await prisma.membre.create({ data: { num: num + i, numInscription: i === 0 ? numInscription : null, nom: `${NOM} ${num + i}`, qualite: "AVOCAT", statut, adresse: "9 rue Secrète", tel: "+242 06 111 22 33" } as never });
    membres.push(m.id);
    return m.id;
  };
  const inscrit = await creer("INSCRIT", 0);
  const radie = await creer("RADIE", 1);
  const omis = await creer("OMIS", 2);
  const q = async (cle: string, membreId: number, annee: number, dateEmission: Date, createdAt = new Date()) => {
    quitus[cle] = (await prisma.quitus.create({ data: { numero: `QV-${num}-${Object.keys(quitus).length}`, membreId, annee, dateEmission, createdAt } })).numero;
  };
  await q("valide", inscrit, 2091, new Date());
  await q("expire", inscrit, 2092, new Date("2025-01-10T10:00:00Z"));
  await q("ancien", inscrit, 2093, new Date("2026-01-10T10:00:00Z"), new Date("2026-01-10T10:00:00Z"));
  await q("radie", radie, 2091, new Date());
  await q("omis", omis, 2091, new Date());
  recu = (await prisma.recu.create({ data: { numero: `RV-${num}`, membreId: inscrit, annee: 2091, montant: 987654, date: new Date(), objet: "Cotisation" } })).numero;
  const n = ((await prisma.timbre.aggregate({ _max: { numero: true } }))._max.numero ?? 0) + 1;
  recuRadie = (await prisma.recu.create({ data: { numero: `RVR-${num}`, membreId: radie, annee: 2091, montant: 5000, date: new Date(), objet: "Cotisation" } })).numero;
  timbre = (await prisma.timbre.create({ data: { numero: n, code: `VERIFT${num}A`, membreId: inscrit, affaire: "Affaire V", montant: 15000 } })).code;
  timbreAnnule = (await prisma.timbre.create({ data: { numero: n + 1, code: `VERIFT${num}B`, membreId: inscrit, affaire: "Affaire W", montant: 15000, statut: "ANNULE" } })).code;
});

afterEach(() => {
  if (basculeAvant === undefined) delete process.env.VERIF_BASCULE;
  else process.env.VERIF_BASCULE = basculeAvant;
});

afterAll(async () => {
  await prisma.timbre.deleteMany({ where: { membreId: { in: membres } } });
  await prisma.recu.deleteMany({ where: { membreId: { in: membres } } });
  await prisma.quitus.deleteMany({ where: { membreId: { in: membres } } });
  await prisma.membre.deleteMany({ where: { id: { in: membres } } });
});

describe("GET /v/:t/:ref — page publique courte", () => {
  it("quitus, jeton valide : 200 « Authentique », numéro, n° d'inscription, date de fin, statut valide", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.valide));
    expect(r.status).toBe(200);
    expect(r.text).toContain("Authentique");
    expect(r.text).toContain(quitus.valide);
    expect(r.text).toContain(numInscription);
    expect(r.text).toContain("Valide jusqu'au");
  });

  it("échappe le nom du titulaire (aucune balise injectée)", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.valide));
    expect(r.text).toContain("VERIF &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(r.text).not.toMatch(/<script/i);
  });

  it("page légère : < 10 Ko, aucun <script>, no-store, noindex, aucun cookie", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.valide));
    expect(Buffer.byteLength(r.text)).toBeLessThan(10 * 1024);
    expect(r.headers["content-type"]).toMatch(/text\/html/);
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.text).toMatch(/<meta name="robots" content="noindex/);
    expect(r.headers["set-cookie"]).toBeUndefined();
    expect(r.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(r.text).toContain("Il ne constitue pas une signature électronique");
    expect(r.text).toContain("Aucune autre information n'est communiquée");
  });

  it("jeton altéré d'un caractère : « Non reconnu », sans aucune donnée", async () => {
    const r = await request(app).get(altere(cheminVerif("q", quitus.valide)));
    expect(r.status).toBe(404);
    expect(r.text).toContain("Non reconnu");
    expect(r.text).not.toContain("VERIF");
    expect(r.text).not.toContain(numInscription);
  });

  it("jeton absent : « Non reconnu »", async () => {
    const r = await request(app).get(`/v/q/${quitus.valide}`);
    expect(r.status).toBe(404);
    expect(r.text).toContain("Non reconnu");
    expect(r.text).not.toContain("VERIF");
  });

  it(":t hors de q|r|t : 404", async () => {
    const r = await request(app).get(`/v/x/${quitus.valide}.AAAAAAAAAA`);
    expect(r.status).toBe(404);
  });

  it("une référence piégée (<script>) n'est jamais renvoyée telle quelle", async () => {
    const r = await request(app).get("/v/q/%3Cscript%3Ealert(1)%3C%2Fscript%3E.AAAAAAAAAA");
    expect(r.text).toContain("Non reconnu");
    expect(r.text).not.toMatch(/<script/i);
  });

  it("quitus expiré : statut « Expiré »", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.expire));
    expect(r.text).toContain("Authentique");
    expect(r.text).toContain("Expiré");
  });

  it("titulaire sorti du tableau : clause CL-STATUT-SORTI, ni nom ni « radié »", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.radie));
    expect(r.text).toContain("Le titulaire n'est pas inscrit au tableau à ce jour.");
    expect(r.text).toContain("Caduc");
    expect(r.text).not.toContain("VERIF");
    expect(r.text).not.toMatch(/radié|radiation|décéd/i);
  });

  it("titulaire omis : quitus « Caduc »", async () => {
    const r = await request(app).get(cheminVerif("q", quitus.omis));
    expect(r.text).toContain("Caduc");
    expect(r.text).not.toMatch(/omis|omission/i);
  });

  it("reçu : numéro, date et exercice, sans montant, adresse, téléphone ni nom", async () => {
    const r = await request(app).get(cheminVerif("r", recu));
    expect(r.status).toBe(200);
    expect(r.text).toContain("Authentique");
    expect(r.text).toContain(recu);
    expect(r.text).toContain("2091");
    expect(r.text).not.toMatch(/987654|FCFA|rue Secrète|111 22 33|VERIF/);
  });

  it("timbre : numéro, date et statut, sans nom de l'avocat (R-64)", async () => {
    const r = await request(app).get(cheminVerif("t", timbre));
    expect(r.status).toBe(200);
    expect(r.text).toContain("Authentique");
    expect(r.text).toContain("Valide");
    expect(r.text).not.toMatch(/VERIF|Affaire V|15 000/);
  });

  it("timbre annulé : « Annulé »", async () => {
    const r = await request(app).get(cheminVerif("t", timbreAnnule));
    expect(r.text).toContain("Annulé");
  });

  it("au-delà du seuil du limiteur : 429", async () => {
    const limite = creerApp({ verification: 2 });
    const chemin = cheminVerif("q", quitus.valide);
    expect((await request(limite).get(chemin)).status).toBe(200);
    expect((await request(limite).get(chemin)).status).toBe(200);
    const r = await request(limite).get(chemin);
    expect(r.status).toBe(429);
    // Le limiteur est partagé avec l'ancienne API : l'énumération ne change pas de guichet.
    expect((await request(limite).get(`/api/verifier/quitus/${quitus.ancien}`)).status).toBe(429);
  });
});

describe("Fiche avocat : liens « Vérifier » vers le chemin signé", () => {
  it("GET /api/membres/:id porte verif sur chaque quitus et chaque reçu", async () => {
    const sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
    const r = await request(app).get(`/api/membres/${membres[0]}`).set("Authorization", `Bearer ${sg}`);
    expect(r.status).toBe(200);
    for (const q of r.body.quitus) expect(q.verif).toBe(urlVerif("q", q.numero));
    expect(r.body.recus[0].verif).toBe(urlVerif("r", recu));
  });
});

describe("Bascule des anciennes URL /api/verifier/... (VERIF_BASCULE)", () => {
  it("un document émis avant la bascule reste vérifiable sans jeton", async () => {
    process.env.VERIF_BASCULE = "2026-06-01";
    const r = await request(app).get(`/api/verifier/quitus/${quitus.ancien}`);
    expect(r.status).toBe(200);
    expect(r.body.valide).toBe(true);
  });

  it("un document émis après la bascule n'est pas authentifié sans jeton, et rien n'est divulgué", async () => {
    process.env.VERIF_BASCULE = "2026-06-01";
    for (const url of [`/api/verifier/quitus/${quitus.valide}`, `/api/verifier/recu/${recu}`, `/api/verifier/timbre/${timbre}`]) {
      const r = await request(app).get(url);
      expect(r.status).toBe(404);
      expect(r.body.valide).toBe(false);
      expect(JSON.stringify(r.body)).not.toMatch(/VERIF <|987654|beneficiaire|signature/);
    }
  });

  it("ancienne voie, minimisation : reçu sans montant ni objet, quitus d'un titulaire sorti sans nom", async () => {
    process.env.VERIF_BASCULE = "2999-01-01";
    const r = await request(app).get(`/api/verifier/recu/${recu}`);
    expect(r.status).toBe(200);
    expect(r.body.valide).toBe(true);
    expect(r.body.montant).toBeUndefined();
    expect(r.body.objet).toBeUndefined();
    const s = await request(app).get(`/api/verifier/quitus/${quitus.radie}`);
    expect(s.body.valide).toBe(true);
    expect(s.body.beneficiaire).toBeUndefined();
    expect(s.body.note).toBe("Le titulaire n'est pas inscrit au tableau à ce jour.");
    expect(JSON.stringify(s.body)).not.toContain("VERIF <");
    expect((await request(app).get(`/api/verifier/quitus/${quitus.valide}`)).body.beneficiaire).toContain("Me ");
  });

  it("ancienne voie, minimisation : reçu d'un titulaire sorti sans nom, reçu d'un titulaire actif avec nom", async () => {
    process.env.VERIF_BASCULE = "2999-01-01";
    const s = await request(app).get(`/api/verifier/recu/${recuRadie}`);
    expect(s.status).toBe(200);
    expect(s.body.valide).toBe(true);
    expect(s.body.beneficiaire).toBeUndefined();
    expect(s.body.note).toBe("Le titulaire n'est pas inscrit au tableau à ce jour.");
    expect(JSON.stringify(s.body)).not.toContain("VERIF <");
    expect((await request(app).get(`/api/verifier/recu/${recu}`)).body.beneficiaire).toContain("Me ");
  });

  it("une date de bascule illisible ferme l'ancienne voie (fail-closed)", async () => {
    process.env.VERIF_BASCULE = "pas-une-date";
    expect((await request(app).get(`/api/verifier/quitus/${quitus.ancien}`)).status).toBe(404);
  });
});
