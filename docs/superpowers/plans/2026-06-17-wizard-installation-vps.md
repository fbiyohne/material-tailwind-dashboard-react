# Wizard d'installation (déploiement VPS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre l'installation de l'application sur un VPS sans coder : une commande de provisionnement (Docker + PostgreSQL + Chromium + HTTPS) puis un assistant web de premier lancement (admin, identité, tarifs, email Gmail optionnel) aboutissant à une base vide.

**Architecture:** Un routeur backend public `installation` exposé uniquement quand `INSTALL_WIZARD=1` et qu'aucun ADMIN n'existe ; un composant front `<Installation/>` rendu en amont du login selon `GET /installation/etat` ; la config SMTP est persistée en base (Parametres.smtp) et lue en priorité par le service mail. Le provisionnement repose sur Docker Compose (app + Postgres + Caddy) piloté par `install.sh`. Sur Render, `INSTALL_WIZARD` est absent → assistant totalement inactif, comportement inchangé.

**Tech Stack:** Express + Prisma + zod + bcryptjs + nodemailer (backend) ; React + Vite (front) ; Docker, Docker Compose, Caddy (provisionnement) ; vitest + supertest (tests).

**Spec de référence :** `docs/superpowers/specs/2026-06-17-wizard-installation-vps-design.md`

---

## Structure des fichiers

**Backend (créés)**
- `server/src/lib/installation.ts` — `wizardActif()` (gating VPS-only).
- `server/src/routes/installation.ts` — routeur public : `GET /etat`, `POST /`, `POST /test-email`.
- `server/test/installation.test.ts` — tests d'intégration (s'exécute après `api.test.ts`, séquentiel).

**Backend (modifiés)**
- `server/src/lib/mail.ts` — SMTP depuis `Parametres.smtp` (base) en priorité, sinon env.
- `server/src/lib/notifications.ts` — utilise la simulation dynamique de `mail.ts`.
- `server/src/routes/cotisations.ts` — `simulation: await emailEnSimulation()`.
- `server/src/app.ts` — monte `installationRouter` sur `/api/installation`.

**Frontend (créés)**
- `src/barreau/pages/Installation.jsx` — assistant 6 étapes.

**Frontend (modifiés)**
- `src/barreau/api/resources.js` — `getEtatInstallation`, `installer`, `testerEmailInstallation`.
- `src/App.jsx` — `InstallationGate` (rend `<Installation/>` si `actif`).

**Provisionnement (créés)**
- `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `install.sh`, `.dockerignore`, `docs/DEPLOIEMENT-VPS.md`.

**Provisionnement (modifiés)**
- `.gitignore` (ajoute `.env`, volumes), `docs/DEPLOIEMENT-RENDER.md` (note assistant inactif).

---

## Task 1 : Helper de gating `wizardActif()`

**Files:**
- Create: `server/src/lib/installation.ts`
- Test: `server/test/installation.test.ts`

- [ ] **Step 1: Écrire le test d'état (assistant inactif sans le flag)**

Créer `server/test/installation.test.ts` :

```ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

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
```

- [ ] **Step 2: Lancer le test → échec (route absente)**

Run: `cd server && npx vitest run test/installation.test.ts`
Expected: FAIL (404 sur `/api/installation/etat`, le routeur n'existe pas).

- [ ] **Step 3: Écrire le helper**

Créer `server/src/lib/installation.ts` :

```ts
import { prisma } from "../prisma.js";

/**
 * L'assistant d'installation n'est actif que sur un déploiement VPS
 * (INSTALL_WIZARD=1), tant qu'aucun compte ADMIN n'existe et que le flag
 * `installe` n'a pas été posé. Sur Render (flag absent) → toujours inactif.
 */
export async function wizardActif(): Promise<boolean> {
  if (process.env.INSTALL_WIZARD !== "1") return false;
  const row = await prisma.parametres.findUnique({ where: { id: 1 } });
  if ((row?.data as { installe?: boolean } | undefined)?.installe) return false;
  const admins = await prisma.user.count({ where: { role: "ADMIN" } });
  return admins === 0;
}
```

(Le routeur qui consomme ce helper est créé en Task 3 ; le test reste rouge jusque-là — c'est attendu, on commit le helper isolément.)

- [ ] **Step 4: Commit**

```bash
git add server/src/lib/installation.ts server/test/installation.test.ts
git commit -m "feat(installation): helper de gating wizardActif (VPS-only)"
```

---

## Task 2 : SMTP depuis la base (mail.ts) + notifications

**Files:**
- Modify: `server/src/lib/mail.ts` (réécriture complète)
- Modify: `server/src/lib/notifications.ts`
- Modify: `server/src/routes/cotisations.ts`
- Test: `server/test/installation.test.ts`

- [ ] **Step 1: Écrire le test (simulation quand aucun SMTP configuré)**

Ajouter dans `server/test/installation.test.ts`, à l'intérieur d'un nouveau bloc :

```ts
import { envoyerMail, emailEnSimulation } from "../src/lib/mail.js";

describe("Mail — config base puis env", () => {
  it("mode simulation quand ni base ni env n'ont de SMTP", async () => {
    delete process.env.SMTP_HOST;
    // s'assurer qu'aucun smtp n'est en base
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = { ...((row?.data as object) ?? {}) };
    delete (data as Record<string, unknown>).smtp;
    await prisma.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });

    expect(await emailEnSimulation()).toBe(true);
    const r = await envoyerMail({ to: "x@y.cg", subject: "s", text: "t" });
    expect(r.simulation).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test → échec**

Run: `cd server && npx vitest run test/installation.test.ts -t "mode simulation"`
Expected: FAIL (`envoyerMail` ne renvoie pas `{ simulation }`, `emailEnSimulation` n'existe pas).

- [ ] **Step 3: Réécrire `mail.ts`**

Remplacer **tout** le contenu de `server/src/lib/mail.ts` par :

```ts
import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";

interface SmtpConfig { host: string; port: number; secure: boolean; user?: string; pass?: string; from: string; }

/**
 * Config SMTP effective : la base (Parametres.smtp, posée par l'assistant
 * d'installation) prime sur les variables d'environnement. null → simulation.
 */
export async function chargerSmtp(): Promise<SmtpConfig | null> {
  try {
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const s = (row?.data as { smtp?: Partial<SmtpConfig> } | undefined)?.smtp;
    if (s?.host) {
      return { host: s.host, port: Number(s.port) || 587, secure: !!s.secure, user: s.user || undefined, pass: s.pass || undefined, from: s.from || "secretariat@barreau-pn.cg" };
    }
  } catch { /* base indisponible : repli sur l'environnement */ }
  if (process.env.SMTP_HOST) {
    return { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, secure: process.env.SMTP_SECURE === "true", user: process.env.SMTP_USER || undefined, pass: process.env.SMTP_PASS || undefined, from: process.env.MAIL_FROM || "secretariat@barreau-pn.cg" };
  }
  return null;
}

export async function emailEnSimulation(): Promise<boolean> {
  return (await chargerSmtp()) === null;
}

export async function envoyerMail(opts: { to: string; subject: string; text: string }): Promise<{ simulation: boolean }> {
  const cfg = await chargerSmtp();
  if (!cfg) {
    console.log(`[mail:simulation] → ${opts.to} : ${opts.subject}`);
    return { simulation: true };
  }
  const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined });
  await transport.sendMail({ from: cfg.from, ...opts });
  return { simulation: false };
}
```

- [ ] **Step 4: Adapter `notifications.ts`**

Dans `server/src/lib/notifications.ts` :

Remplacer l'import :
```ts
import { envoyerMail, modeSimulation as emailSimule } from "./mail.js";
```
par :
```ts
import { envoyerMail, emailEnSimulation } from "./mail.js";
export { emailEnSimulation };
```

Supprimer la ligne :
```ts
export const modeSimulationEmail = emailSimule;
```

Remplacer la fonction `envoyerEmail` par :
```ts
export async function envoyerEmail(opts: { to: string; subject: string; text: string; evenement: string }): Promise<{ statut: "ENVOYE" | "ECHEC"; simulation: boolean }> {
  let statut: "ENVOYE" | "ECHEC" = "ENVOYE";
  let simulation = true;
  try {
    const r = await envoyerMail({ to: opts.to, subject: opts.subject, text: opts.text });
    simulation = r.simulation;
  } catch (err) {
    statut = "ECHEC";
    simulation = await emailEnSimulation();
    logger.warn({ err, to: opts.to }, "Échec d'envoi d'email");
  }
  await journaliser("EMAIL", opts.to, opts.subject, opts.evenement, statut, simulation);
  return { statut, simulation };
}
```

- [ ] **Step 5: Adapter `cotisations.ts`**

Dans `server/src/routes/cotisations.ts`, l'import existant des notifications :
```ts
import { envoyerEmail, envoyerSms, modeSimulationEmail } from "../lib/notifications.js";
```
devient :
```ts
import { envoyerEmail, envoyerSms, emailEnSimulation } from "../lib/notifications.js";
```
Et la réponse des relances :
```ts
res.json({ annee, envoyes, simulation: modeSimulationEmail, destinataires: cibles.map((m) => ({ nom: m.nom, email: m.email })) });
```
devient :
```ts
res.json({ annee, envoyes, simulation: await emailEnSimulation(), destinataires: cibles.map((m) => ({ nom: m.nom, email: m.email })) });
```

- [ ] **Step 6: Vérifier types + test**

Run: `cd server && npx tsc --noEmit && npx vitest run test/installation.test.ts -t "mode simulation"`
Expected: TSC OK ; test PASS.

- [ ] **Step 7: Non-régression complète**

Run: `cd server && npm test`
Expected: 74 tests (api.test.ts) + nouveaux passent (les tests d'état de Task 1 restent rouges tant que le routeur n'est pas monté — Task 3/4).

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/mail.ts server/src/lib/notifications.ts server/src/routes/cotisations.ts
git commit -m "feat(mail): SMTP depuis la base (Parametres.smtp) prioritaire sur l'env"
```

---

## Task 3 : Routeur d'installation (etat / install / test-email)

**Files:**
- Create: `server/src/routes/installation.ts`
- Test: `server/test/installation.test.ts`

- [ ] **Step 1: Écrire les tests refus + succès (avec restauration)**

Ajouter dans `server/test/installation.test.ts` :

```ts
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
  beforeAll(async () => {
    process.env.INSTALL_WIZARD = "1";
    await prisma.user.deleteMany({ where: { role: "ADMIN" } });
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = { ...((row?.data as object) ?? {}) };
    delete (data as Record<string, unknown>).installe;
    await prisma.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
  });

  afterAll(async () => {
    // Restaure un admin standard pour ne pas laisser la base sans admin.
    await prisma.user.upsert({
      where: { email: "admin@barreau-pn.cg" },
      update: { passwordHash: bcrypt.hashSync("barreau", 10), role: "ADMIN" },
      create: { nom: "Administrateur système", email: "admin@barreau-pn.cg", role: "ADMIN", passwordHash: bcrypt.hashSync("barreau", 10) },
    });
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
    const admin = await prisma.user.findUnique({ where: { email: "admin.test@barreau-pn.cg" } });
    expect(admin?.role).toBe("ADMIN");
    const row = await prisma.parametres.findUnique({ where: { id: 1 } });
    const data = row?.data as Record<string, any>;
    expect(data.installe).toBe(true);
    expect(data.identite.denomination).toBe("Barreau X");
    expect(data.smtp.host).toBe("smtp.gmail.com");
    // le login fonctionne avec le nouvel admin
    const login = await request(app).post("/api/auth/login").send({ email: "admin.test@barreau-pn.cg", password: "motdepasse123" });
    expect(login.status).toBe(200);
  });

  it("POST de nouveau → 409 (installe posé + admin présent)", async () => {
    const r = await request(app).post("/api/installation").send({});
    expect(r.status).toBe(409);
  });
});
```

- [ ] **Step 2: Lancer → échec**

Run: `cd server && npx vitest run test/installation.test.ts`
Expected: FAIL (routeur absent).

- [ ] **Step 3: Écrire le routeur**

Créer `server/src/routes/installation.ts` :

```ts
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { prisma } from "../prisma.js";
import { asyncH, HttpError } from "../middleware/error.js";
import { wizardActif } from "../lib/installation.js";

export const installationRouter = Router();

/** GET /installation/etat — l'assistant doit-il s'afficher ? (VPS uniquement). */
installationRouter.get("/etat", asyncH(async (_req, res) => {
  res.json({ actif: await wizardActif() });
}));

const smtpSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  user: z.string().optional().default(""),
  pass: z.string().optional().default(""),
  from: z.string().trim().min(1),
  secure: z.boolean().optional().default(false),
});

const installSchema = z.object({
  admin: z.object({ nom: z.string().trim().min(1), email: z.string().email(), motDePasse: z.string().min(8) }),
  identite: z.object({
    denomination: z.string().trim().min(1), ordre: z.string().trim().min(1),
    batonnier: z.string().trim().min(1), tresoriere: z.string().trim().min(1),
    secretaireGeneral: z.string().trim().min(1), adresse: z.string().trim().min(1),
  }),
  tarifs: z.object({ avocat: z.number().int().nonnegative(), stagiaire: z.number().int().nonnegative(), droitsPlaidoirie: z.number().int().nonnegative() }),
  exerciceCourant: z.number().int(),
  premierExercice: z.number().int(),
  smtp: smtpSchema.nullable().optional(),
});

/** POST /installation — crée le 1er admin + écrit la config (transaction). */
installationRouter.post("/", asyncH(async (req, res) => {
  if (!(await wizardActif())) throw new HttpError(409, "Application déjà installée.");
  const d = installSchema.parse(req.body);
  await prisma.$transaction(async (tx) => {
    await tx.user.create({ data: { nom: d.admin.nom, email: d.admin.email.toLowerCase(), role: "ADMIN", passwordHash: bcrypt.hashSync(d.admin.motDePasse, 10) } });
    const row = await tx.parametres.findUnique({ where: { id: 1 } });
    const base = (row?.data as object) ?? {};
    const data = {
      ...base,
      identite: d.identite,
      tarifs: d.tarifs,
      exerciceCourant: d.exerciceCourant,
      exercices: { premier: d.premierExercice },
      ...(d.smtp ? { smtp: d.smtp } : {}),
      installe: true,
    };
    await tx.parametres.upsert({ where: { id: 1 }, create: { id: 1, data }, update: { data } });
  });
  res.status(201).json({ ok: true });
}));

/** POST /installation/test-email — test d'envoi avec le SMTP saisi (non persisté). */
installationRouter.post("/test-email", asyncH(async (req, res) => {
  if (!(await wizardActif())) throw new HttpError(409, "Application déjà installée.");
  const s = smtpSchema.extend({ to: z.string().email() }).parse(req.body);
  const transport = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.secure, auth: s.user ? { user: s.user, pass: s.pass } : undefined });
  await transport.sendMail({ from: s.from, to: s.to, subject: "Test — Barreau de Pointe-Noire", text: "Votre configuration SMTP fonctionne." });
  res.json({ ok: true });
}));
```

- [ ] **Step 4: Monter le routeur (sinon les tests restent 404)**

Voir Task 4 (à faire avant de relancer les tests de cette task).

---

## Task 4 : Monter le routeur dans `app.ts`

**Files:**
- Modify: `server/src/app.ts`

- [ ] **Step 1: Ajouter l'import**

Après les autres imports de routes (vers la ligne 40) dans `server/src/app.ts` :
```ts
import { installationRouter } from "./routes/installation.js";
```

- [ ] **Step 2: Monter le routeur (public, avant l'auth)**

Juste avant `app.use("/api/auth", authRouter);` :
```ts
app.use("/api/installation", installationRouter);
```
(Public : aucun `requireAuth`. `confinementAvocat` laisse passer les requêtes sans jeton.)

- [ ] **Step 3: Lancer toute la suite installation**

Run: `cd server && npx tsc --noEmit && npx vitest run test/installation.test.ts`
Expected: tous PASS (état, refus 409, validation 400, succès 201 + login, re-409).

- [ ] **Step 4: Non-régression complète**

Run: `cd server && npm test`
Expected: tout PASS (74 + installation).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/installation.ts server/src/app.ts server/test/installation.test.ts
git commit -m "feat(installation): routeur etat/install/test-email + montage public"
```

---

## Task 5 : Ressources front

**Files:**
- Modify: `src/barreau/api/resources.js`

- [ ] **Step 1: Ajouter les fonctions**

Après la ligne `export const reinitialiserDonnees = ...` dans `src/barreau/api/resources.js` :

```js
// ─── Installation (assistant de premier lancement, VPS) ──────────────────────
export const getEtatInstallation = () => api("/installation/etat", { auth: false });
export const installer = (body) => api("/installation", { method: "POST", auth: false, body });
export const testerEmailInstallation = (body) => api("/installation/test-email", { method: "POST", auth: false, body });
```

- [ ] **Step 2: Vérifier le build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/barreau/api/resources.js
git commit -m "feat(installation): ressources front (etat/installer/test-email)"
```

---

## Task 6 : Assistant `<Installation/>`

**Files:**
- Create: `src/barreau/pages/Installation.jsx`

- [ ] **Step 1: Écrire le composant complet**

Créer `src/barreau/pages/Installation.jsx` :

```jsx
import { useState } from "react";
import { useToast } from "../components";
import { installer, testerEmailInstallation } from "../api/resources";

const ETAPES = ["Bienvenue", "Administrateur", "Institution", "Tarifs & exercice", "Email", "Récapitulatif"];

const IDENTITE_DEFAUT = {
  denomination: "Barreau de Pointe-Noire",
  ordre: "Ordre National des Avocats du Congo",
  batonnier: "", tresoriere: "", secretaireGeneral: "",
  adresse: "Maison de l'Avocat — Pointe-Noire, République du Congo",
};
const TARIFS_DEFAUT = { avocat: 150000, stagiaire: 75000, droitsPlaidoirie: 60000 };
// Pré-réglages Gmail (mot de passe d'application requis — pas le mot de passe du compte).
const SMTP_DEFAUT = { host: "smtp.gmail.com", port: 587, user: "", pass: "", from: "", secure: false };

const Champ = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gris">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-gris">{hint}</span>}
  </label>
);

export function Installation() {
  const toast = useToast();
  const [etape, setEtape] = useState(0);
  const [admin, setAdmin] = useState({ nom: "", email: "", motDePasse: "", confirme: "" });
  const [identite, setIdentite] = useState(IDENTITE_DEFAUT);
  const [tarifs, setTarifs] = useState(TARIFS_DEFAUT);
  const [exercice, setExercice] = useState(new Date().getFullYear());
  const [premier, setPremier] = useState(new Date().getFullYear() - 6);
  const [emailActif, setEmailActif] = useState(false);
  const [smtp, setSmtp] = useState(SMTP_DEFAUT);
  const [testCible, setTestCible] = useState("");
  const [enCours, setEnCours] = useState(false);

  const setA = (k) => (e) => setAdmin({ ...admin, [k]: e.target.value });
  const setI = (k) => (e) => setIdentite({ ...identite, [k]: e.target.value });
  const setT = (k) => (e) => setTarifs({ ...tarifs, [k]: Number(String(e.target.value).replace(/\D/g, "")) || 0 });
  const setS = (k) => (e) => setSmtp({ ...smtp, [k]: k === "port" ? Number(e.target.value) || 0 : e.target.value });

  const adminValide = admin.nom.trim() && /\S+@\S+\.\S+/.test(admin.email) && admin.motDePasse.length >= 8 && admin.motDePasse === admin.confirme;
  const identiteValide = Object.values(identite).every((v) => v.trim());
  const peutSuivant = etape === 1 ? adminValide : etape === 2 ? identiteValide : true;

  const tester = async () => {
    if (!smtp.host || !smtp.from || !/\S+@\S+\.\S+/.test(testCible)) { toast.error("Renseignez le SMTP et une adresse de test."); return; }
    setEnCours(true);
    try { await testerEmailInstallation({ ...smtp, to: testCible }); toast.success("Email de test envoyé."); }
    catch (e) { toast.error(e.message); }
    finally { setEnCours(false); }
  };

  const installerApp = async () => {
    setEnCours(true);
    try {
      await installer({
        admin: { nom: admin.nom.trim(), email: admin.email.trim(), motDePasse: admin.motDePasse },
        identite, tarifs, exerciceCourant: Number(exercice), premierExercice: Number(premier),
        smtp: emailActif && smtp.host ? smtp : null,
      });
      toast.success("Installation terminée. Connectez-vous avec votre compte administrateur.");
      setTimeout(() => window.location.assign("/"), 1000);
    } catch (e) { toast.error(e.message); setEnCours(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-3 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-grisM bg-white shadow-modal">
        <div className="bg-navy px-6 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-or">Barreau de Pointe-Noire</div>
          <div className="font-display text-lg text-white">Installation — étape {etape + 1}/{ETAPES.length} · {ETAPES[etape]}</div>
        </div>
        <div className="h-1 bg-grisL"><div className="h-full bg-or transition-all" style={{ width: `${((etape + 1) / ETAPES.length) * 100}%` }} /></div>

        <div className="space-y-4 px-6 py-6">
          {etape === 0 && (
            <p className="text-sm leading-7 text-encre">Bienvenue. Cet assistant configure votre installation : compte administrateur, identité de l'Ordre, tarifs et email (optionnel). À la fin, la base sera vide et prête : vous importerez vos avocats depuis le module Avocats.</p>
          )}

          {etape === 1 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Nom affiché"><input value={admin.nom} onChange={setA("nom")} className="bpn-input" placeholder="Administrateur système" /></Champ>
              <Champ label="Email"><input type="email" value={admin.email} onChange={setA("email")} className="bpn-input" placeholder="admin@votre-barreau.cg" /></Champ>
              <Champ label="Mot de passe" hint="8 caractères minimum"><input type="password" value={admin.motDePasse} onChange={setA("motDePasse")} className="bpn-input" /></Champ>
              <Champ label="Confirmer le mot de passe"><input type="password" value={admin.confirme} onChange={setA("confirme")} className={`bpn-input ${admin.confirme && admin.confirme !== admin.motDePasse ? "is-invalid" : ""}`} /></Champ>
            </div>
          )}

          {etape === 2 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Dénomination"><input value={identite.denomination} onChange={setI("denomination")} className="bpn-input" /></Champ>
              <Champ label="Ordre"><input value={identite.ordre} onChange={setI("ordre")} className="bpn-input" /></Champ>
              <Champ label="Bâtonnier"><input value={identite.batonnier} onChange={setI("batonnier")} className="bpn-input" /></Champ>
              <Champ label="Trésorière"><input value={identite.tresoriere} onChange={setI("tresoriere")} className="bpn-input" /></Champ>
              <Champ label="Secrétaire Général"><input value={identite.secretaireGeneral} onChange={setI("secretaireGeneral")} className="bpn-input" /></Champ>
              <Champ label="Adresse"><input value={identite.adresse} onChange={setI("adresse")} className="bpn-input" /></Champ>
            </div>
          )}

          {etape === 3 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Cotisation avocat (FCFA)"><input value={tarifs.avocat} onChange={setT("avocat")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Cotisation stagiaire (FCFA)"><input value={tarifs.stagiaire} onChange={setT("stagiaire")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Droit de plaidoirie (FCFA)"><input value={tarifs.droitsPlaidoirie} onChange={setT("droitsPlaidoirie")} className="bpn-input" inputMode="numeric" /></Champ>
              <Champ label="Exercice courant"><input type="number" value={exercice} onChange={(e) => setExercice(e.target.value)} className="bpn-input" /></Champ>
              <Champ label="Premier exercice" hint="borne basse des filtres"><input type="number" value={premier} onChange={(e) => setPremier(e.target.value)} className="bpn-input" /></Champ>
            </div>
          )}

          {etape === 4 && (
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-encre">
                <input type="checkbox" checked={emailActif} onChange={(e) => setEmailActif(e.target.checked)} className="h-4 w-4 accent-navy" />
                Configurer l'envoi d'emails (Gmail) — sinon les notifications restent en simulation.
              </label>
              {emailActif && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Champ label="Serveur SMTP"><input value={smtp.host} onChange={setS("host")} className="bpn-input" /></Champ>
                  <Champ label="Port"><input type="number" value={smtp.port} onChange={setS("port")} className="bpn-input" /></Champ>
                  <Champ label="Utilisateur (adresse Gmail)"><input value={smtp.user} onChange={setS("user")} className="bpn-input" placeholder="vous@gmail.com" /></Champ>
                  <Champ label="Mot de passe d'application" hint="Gmail : créez un « mot de passe d'application » (2FA requise)."><input type="password" value={smtp.pass} onChange={setS("pass")} className="bpn-input" /></Champ>
                  <Champ label="Expéditeur (From)"><input value={smtp.from} onChange={setS("from")} className="bpn-input" placeholder="vous@gmail.com" /></Champ>
                  <div className="flex items-end gap-2">
                    <input value={testCible} onChange={(e) => setTestCible(e.target.value)} className="bpn-input" placeholder="email de test" />
                    <button type="button" onClick={tester} disabled={enCours} className="bpn-btn bpn-btn-ghost shrink-0">Tester</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {etape === 5 && (
            <div className="space-y-2 text-sm text-encre">
              <div><span className="text-gris">Administrateur :</span> {admin.nom} ({admin.email})</div>
              <div><span className="text-gris">Institution :</span> {identite.denomination}</div>
              <div><span className="text-gris">Tarifs :</span> avocat {tarifs.avocat} · stagiaire {tarifs.stagiaire} · droit {tarifs.droitsPlaidoirie} FCFA</div>
              <div><span className="text-gris">Exercices :</span> {exercice} → {premier}</div>
              <div><span className="text-gris">Email :</span> {emailActif && smtp.host ? `${smtp.host} (${smtp.user})` : "simulation"}</div>
              <p className="pt-2 text-xs text-gris">La base démarrera vide (seuls le compte admin et cette configuration). Action finale ci-dessous.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-grisM px-6 py-4">
          <button type="button" className="bpn-btn bpn-btn-ghost disabled:opacity-40" disabled={etape === 0 || enCours} onClick={() => setEtape((s) => s - 1)}>Précédent</button>
          {etape < ETAPES.length - 1 ? (
            <button type="button" className="bpn-btn bpn-btn-primary disabled:opacity-40" disabled={!peutSuivant} onClick={() => setEtape((s) => s + 1)}>Suivant</button>
          ) : (
            <button type="button" className="bpn-btn bpn-btn-or disabled:opacity-40" disabled={enCours} onClick={installerApp}>{enCours ? "Installation…" : "Installer l'application"}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Installation;
```

- [ ] **Step 2: Vérifier le build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/barreau/pages/Installation.jsx
git commit -m "feat(installation): assistant web 6 étapes (admin, identité, tarifs, email Gmail)"
```

---

## Task 7 : Aiguillage `InstallationGate` dans `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Ajouter les imports**

Dans `src/App.jsx`, après les imports existants :
```js
import { useEffect, useState } from "react";
import { Installation } from "@/barreau/pages/Installation";
import { getEtatInstallation } from "@/barreau/api/resources";
```

- [ ] **Step 2: Ajouter le composant de garde**

Ajouter avant `function PublicOrApp()` :
```jsx
/** Sur un VPS non encore installé (INSTALL_WIZARD), affiche l'assistant.
 *  Sur Render (assistant inactif), passe immédiatement à l'application. */
function InstallationGate({ children }) {
  const [etat, setEtat] = useState(null); // null = en cours
  useEffect(() => {
    getEtatInstallation().then(setEtat).catch(() => setEtat({ actif: false }));
  }, []);
  if (etat === null) return <Splash />;
  if (etat.actif) return <Installation />;
  return children;
}
```

- [ ] **Step 3: Brancher la garde**

Dans `PublicOrApp`, remplacer la dernière ligne :
```jsx
  return <AuthGate />;
```
par :
```jsx
  return <InstallationGate><AuthGate /></InstallationGate>;
```

- [ ] **Step 4: Vérifier le build + non-régression Render (assistant inactif)**

Run: `npm run build`
Expected: build OK. (En l'absence de `INSTALL_WIZARD` côté serveur, `getEtatInstallation` renvoie `actif:false` → l'app affiche le login comme avant.)

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(installation): garde d'aiguillage vers l'assistant (VPS) en amont du login"
```

---

## Task 8 : Dockerfile

**Files:**
- Create: `Dockerfile`, `.dockerignore`

- [ ] **Step 1: Écrire le `.dockerignore`**

Créer `.dockerignore` :
```
node_modules
server/node_modules
dist
.git
.env
*.log
caddy_data
```

- [ ] **Step 2: Écrire le `Dockerfile`**

Créer `Dockerfile` :
```dockerfile
FROM node:22-bookworm-slim

# Chromium pour la génération PDF (Puppeteer) + dépendances de polices.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ca-certificates fonts-liberation fonts-dejavu-core openssl \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    STATIC_DIR=../dist

WORKDIR /app

# Dépendances front + build (devDependencies nécessaires : vite).
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Dépendances serveur (tsx/prisma en dev) + client Prisma.
RUN npm ci --include=dev --prefix server && npm run prisma:generate --prefix server

EXPOSE 4000
# Migrations puis démarrage (pas de seed → base vide).
CMD ["sh", "-c", "npm run prisma:deploy --prefix server && npm start --prefix server"]
```

- [ ] **Step 3: Validation de syntaxe (build non requis ici)**

Run: `docker build --help >/dev/null 2>&1 && echo "docker présent" || echo "docker absent (validation différée au VPS)"`
Expected: la commande s'exécute (le build réel se fait sur le VPS via compose).

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "build(vps): Dockerfile (Node + Chromium, build front, migrate au démarrage)"
```

---

## Task 9 : docker-compose + Caddy

**Files:**
- Create: `docker-compose.yml`, `Caddyfile`

- [ ] **Step 1: Écrire `docker-compose.yml`**

Créer `docker-compose.yml` :
```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: barreau_pn
      POSTGRES_USER: barreau
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U barreau -d barreau_pn"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://barreau:${POSTGRES_PASSWORD}@db:5432/barreau_pn?schema=public
      JWT_SECRET: ${JWT_SECRET}
      SIGNATURE_SECRET: ${SIGNATURE_SECRET}
      CLIENT_ORIGIN: ${CLIENT_ORIGIN}
      INSTALL_WIZARD: "1"
      STATIC_DIR: ../dist
      PUPPETEER_EXECUTABLE_PATH: /usr/bin/chromium
      NODE_ENV: production
    expose:
      - "4000"

  caddy:
    image: caddy:2
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMAIN: ${DOMAIN}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  db-data:
  caddy-data:
  caddy-config:
```

- [ ] **Step 2: Écrire le `Caddyfile`**

Créer `Caddyfile` :
```
{$DOMAIN} {
	reverse_proxy app:4000
}
```
(Si `DOMAIN` est vide, Caddy écoute en HTTP sur `:80` ; `install.sh` met `DOMAIN=:80` dans ce cas.)

- [ ] **Step 3: Validation**

Run: `grep -q "INSTALL_WIZARD" docker-compose.yml && echo OK`
Expected: `OK` (le flag VPS-only est bien posé côté compose).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml Caddyfile
git commit -m "build(vps): docker-compose (app+postgres+caddy HTTPS auto) + Caddyfile"
```

---

## Task 10 : Script `install.sh`

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Écrire le script**

Créer `install.sh` :
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "== Installation — Barreau de Pointe-Noire (VPS) =="

# 1. Docker + plugin Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "Installation de Docker…"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin docker compose est requis (Docker récent). Abandon." >&2
  exit 1
fi

# 2. Domaine (vide → HTTP simple)
read -rp "Nom de domaine (laisser vide pour HTTP sur l'IP) : " DOMAIN_INPUT
if [ -z "$DOMAIN_INPUT" ]; then
  DOMAIN=":80"; CLIENT_ORIGIN="http://localhost"
else
  DOMAIN="$DOMAIN_INPUT"; CLIENT_ORIGIN="https://$DOMAIN_INPUT"
fi

# 3. Secrets + .env (ne pas écraser un .env existant)
if [ -f .env ]; then
  echo ".env déjà présent — réutilisé."
else
  echo "Génération des secrets…"
  {
    echo "DOMAIN=$DOMAIN"
    echo "CLIENT_ORIGIN=$CLIENT_ORIGIN"
    echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "SIGNATURE_SECRET=$(openssl rand -hex 32)"
  } > .env
  chmod 600 .env
fi

# 4. Build + lancement
echo "Construction et démarrage des conteneurs…"
docker compose up -d --build

echo ""
echo "== Terminé =="
if [ "$DOMAIN" = ":80" ]; then
  echo "Ouvrez http://<IP-du-serveur> pour finaliser l'installation."
else
  echo "Ouvrez https://$DOMAIN pour finaliser l'installation (l'assistant web)."
fi
```

- [ ] **Step 2: Rendre exécutable + vérifier la syntaxe**

Run: `chmod +x install.sh && bash -n install.sh && echo "syntaxe OK"`
Expected: `syntaxe OK`.

- [ ] **Step 3: Commit**

```bash
git add install.sh
git commit -m "build(vps): install.sh — bootstrap une commande (Docker, secrets, HTTPS, up)"
```

---

## Task 11 : `.gitignore` + documentation

**Files:**
- Modify: `.gitignore`
- Create: `docs/DEPLOIEMENT-VPS.md`
- Modify: `docs/DEPLOIEMENT-RENDER.md`

- [ ] **Step 1: Mettre à jour `.gitignore`**

Ajouter à la fin de `.gitignore` :
```
# Déploiement VPS
.env
caddy_data/
caddy_config/
```

- [ ] **Step 2: Écrire `docs/DEPLOIEMENT-VPS.md`**

Créer `docs/DEPLOIEMENT-VPS.md` :
```markdown
# Déploiement sur un VPS (production)

Installation **sans coder**, en deux temps : provisionnement par script, puis
assistant web de configuration.

## 1. Provisionnement (une commande)

Sur un VPS **Ubuntu/Debian** frais, en `root` (ou sudo), dans le dépôt cloné :

\`\`\`bash
git clone <URL-du-depot> barreau && cd barreau
bash install.sh
\`\`\`

Le script : installe Docker si absent, demande le **domaine** (pour le HTTPS
automatique), génère les secrets (`.env`), construit et lance les conteneurs
(**app + PostgreSQL + Chromium + Caddy**). La base démarre **vide**.

> Pré-requis HTTPS : le domaine doit pointer (DNS A/AAAA) vers l'IP du VPS ;
> Caddy obtient alors un certificat Let's Encrypt automatiquement.

## 2. Assistant web (premier lancement)

Ouvrez l'URL affichée par le script. L'**assistant d'installation** apparaît
(il n'existe que sur le VPS, grâce à `INSTALL_WIZARD=1`) et vous guide :

1. Compte **administrateur** (email + mot de passe ≥ 8 caractères)
2. **Identité** de l'Ordre (dénomination, Bâtonnier, Trésorière, SG, adresse)
3. **Tarifs & exercice**
4. **Email (Gmail, optionnel)** : `smtp.gmail.com` port `587`, utilisateur =
   votre adresse Gmail, mot de passe = **mot de passe d'application** Google
   (activez la 2FA puis créez-en un) ; bouton « Tester ».
5. Récapitulatif → **Installer**.

À la fin, connectez-vous avec le compte administrateur. La base est **vide** :
importez vos avocats via **Avocats → Importer** (.xlsx/.csv), puis créez les
comptes Secrétaire Général / Bâtonnier / Trésorière dans **Utilisateurs**.

## Données & sauvegardes

Les données PostgreSQL persistent dans le volume Docker `db-data`. Sauvegarde
recommandée :
\`\`\`bash
docker compose exec db pg_dump -U barreau barreau_pn > sauvegarde-$(date +%F).sql
\`\`\`

## Mise à jour

\`\`\`bash
git pull && docker compose up -d --build
\`\`\`
Les migrations s'appliquent au démarrage. L'assistant ne réapparaît pas (un
admin existe déjà).
```

- [ ] **Step 3: Noter l'inactivité sur Render**

Ajouter à la fin de `docs/DEPLOIEMENT-RENDER.md` :
```markdown

## Assistant d'installation

L'assistant d'installation (déploiement VPS) **n'est jamais actif sur Render** :
la variable `INSTALL_WIZARD` n'y est pas définie, et le seed crée déjà le compte
administrateur. Le déploiement Render se comporte donc comme aujourd'hui.
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore docs/DEPLOIEMENT-VPS.md docs/DEPLOIEMENT-RENDER.md
git commit -m "docs(vps): guide de déploiement VPS + note assistant inactif sur Render"
```

---

## Vérification finale (après toutes les tasks)

- [ ] `cd server && npx tsc --noEmit` → OK
- [ ] `cd server && npm test` → tous les tests (api + installation) passent
- [ ] `npm run build` → OK
- [ ] `npm test` (front) → OK
- [ ] `bash -n install.sh` → OK
- [ ] Vérification manuelle VPS-only : `GET /api/installation/etat` sans `INSTALL_WIZARD` → `{actif:false}` ; avec `INSTALL_WIZARD=1` et base sans admin → `{actif:true}`.

---

## Self-review (couverture spec)

- Provisionnement une commande (Docker/Postgres/Chromium/HTTPS) → Tasks 8-10. ✅
- Assistant web 6 étapes (admin, identité, tarifs, email Gmail) → Tasks 6-7. ✅
- Backend etat/install/test-email + gating VPS-only → Tasks 1, 3, 4. ✅
- SMTP en base prioritaire sur env → Task 2. ✅
- Sécurité (409 si installé, public mais verrouillé) → Task 3 (tests 409). ✅
- Render inchangé (INSTALL_WIZARD absent → inactif) → Tasks 1, 7, 11 (test + note). ✅
- Tests d'intégration (état, refus, succès, validation) → Tasks 1-4. ✅
- Hors-périmètre (upgrades, sauvegardes auto) → documentés, non implémentés. ✅
