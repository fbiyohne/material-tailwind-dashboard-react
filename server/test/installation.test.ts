import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { envoyerMail, emailEnSimulation } from "../src/lib/mail.js";

const app = creerApp();

describe("Installation — gating", () => {
  it("assistant inactif si INSTALL_WIZARD absent (cas Render)", async () => {
    delete process.env.INSTALL_WIZARD;
    const r = await request(app).get("/api/installation/etat");
    expect(r.status).toBe(200);
    expect(r.body.actif).toBe(false);
  });

  it("assistant inactif si un ADMIN existe déjà, même avec le flag", async () => {
    process.env.INSTALL_WIZARD = "1";
    const r = await request(app).get("/api/installation/etat"); // base seedée → admin présent
    expect(r.body.actif).toBe(false);
    delete process.env.INSTALL_WIZARD;
  });
});

describe("Mail — config base puis env", () => {
  it("mode simulation quand ni base ni env n'ont de SMTP", async () => {
    delete process.env.SMTP_HOST;
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = { ...((row?.data as object) ?? {}) };
    delete (data as Record<string, unknown>).smtp;
    await prisma.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });

    expect(await emailEnSimulation()).toBe(true);
    const r = await envoyerMail({ to: "x@y.cg", subject: "s", text: "t" });
    expect(r.simulation).toBe(true);
  });
});

describe("Installation — endpoints", () => {
  it("POST refusé (409) sans le flag", async () => {
    delete process.env.INSTALL_WIZARD;
    const r = await request(app).post("/api/installation").send({});
    expect(r.status).toBe(409);
  });

  it("POST refusé (409) si un ADMIN existe déjà", async () => {
    process.env.INSTALL_WIZARD = "1";
    const r = await request(app).post("/api/installation").send({});
    expect(r.status).toBe(409); // base seedée → admin présent
    delete process.env.INSTALL_WIZARD;
  });
});

describe("Installation — parcours actif (destructif, restauré en fin)", () => {
  // Snapshot de la config d'origine : ce bloc réécrit Parametres.data (tarifs,
  // identité, flag installe…) via la route d'installation. On le restaure en fin
  // pour que la suite reste rejouable (sinon api.test.ts lirait des tarifs altérés).
  let parametresOriginaux: unknown = null;

  beforeAll(async () => {
    process.env.INSTALL_WIZARD = "1";
    await prisma.user.deleteMany({ where: { role: "ADMIN" } });
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    parametresOriginaux = row?.data ?? null;
    const data = { ...((row?.data as object) ?? {}) };
    delete (data as Record<string, unknown>).installe;
    await prisma.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
  });

  afterAll(async () => {
    // Supprime l'admin créé par le parcours puis restaure l'admin de seed.
    await prisma.user.deleteMany({ where: { email: "admin.test@barreau-pn.cg" } });
    await prisma.user.upsert({
      where: { email: "admin@barreau-pn.cg" },
      update: { passwordHash: bcrypt.hashSync("barreau", 10), role: "ADMIN" },
      create: { nom: "Administrateur système", email: "admin@barreau-pn.cg", role: "ADMIN", passwordHash: bcrypt.hashSync("barreau", 10) },
    });
    // Restaure la configuration d'origine (tarifs, identité, absence de flag/smtp).
    if (parametresOriginaux !== null) {
      const data = parametresOriginaux as object;
      await prisma.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
    }
    delete process.env.INSTALL_WIZARD;
  });

  it("etat = actif quand flag + aucun admin", async () => {
    const r = await request(app).get("/api/installation/etat");
    expect(r.body.actif).toBe(true);
  });

  it("POST validation : mot de passe trop court → 400", async () => {
    const r = await request(app).post("/api/installation").send({
      admin: { nom: "X", email: "a@b.cg", motDePasse: "court" },
      identite: { denomination: "d", ordre: "o", batonnier: "b", tresoriere: "t", secretaireGeneral: "s", adresse: "a" },
      tarifs: { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 },
      exerciceCourant: 2026, premierExercice: 2020,
    });
    expect(r.status).toBe(400);
  });

  it("POST succès : crée l'admin + écrit la config + pose installe", async () => {
    const r = await request(app).post("/api/installation").send({
      admin: { nom: "Admin Test", email: "Admin.Test@Barreau-PN.cg", motDePasse: "motdepasse123" },
      identite: { denomination: "Barreau X", ordre: "Ordre X", batonnier: "Me B", tresoriere: "Me T", secretaireGeneral: "Me S", adresse: "Adresse X" },
      tarifs: { avocat: 200000, stagiaire: 100000, droitsPlaidoirie: 50000 },
      exerciceCourant: 2027, premierExercice: 2021,
      smtp: { host: "smtp.gmail.com", port: 587, user: "u@gmail.com", pass: "app-pass", from: "u@gmail.com", secure: false },
    });
    expect(r.status).toBe(201);
    // L'email est stocké TEL QUEL (casse préservée) : on le retrouve avec la
    // casse exacte saisie, et la connexion doit fonctionner avec cette même
    // casse — régression contre un verrouillage de l'admin (cf. revue).
    const admin = await prisma.user.findUnique({ where: { email: "Admin.Test@Barreau-PN.cg" } });
    expect(admin?.role).toBe("ADMIN");
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = row?.data as Record<string, any>;
    expect(data.installe).toBe(true);
    expect(data.identite.denomination).toBe("Barreau X");
    expect(data.smtp.host).toBe("smtp.gmail.com");
    const login = await request(app).post("/api/auth/login").send({ email: "Admin.Test@Barreau-PN.cg", password: "motdepasse123" });
    expect(login.status).toBe(200);
  });

  it("POST de nouveau → 409 (installe posé + admin présent)", async () => {
    const r = await request(app).post("/api/installation").send({});
    expect(r.status).toBe(409);
  });
});
