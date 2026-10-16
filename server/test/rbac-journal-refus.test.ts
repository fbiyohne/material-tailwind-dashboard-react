import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";

/**
 * T9 (M-20261016) — correctifs RBAC serveur prouvés par requêtes HTTP :
 * - D18 : une écriture refusée en 403 écrit « Accès refusé — <ressource> » dans JournalAudit,
 *   sans le corps de la requête ; PUT /rbac écrit toujours sa ligne ;
 * - R-62 : la lecture d'un dossier disciplinaire (et de la liste) par le Bâtonnier est journalisée ;
 * - R-58 : l'ADMIN reçoit 403 sur le contenu d'un message et d'une pièce réels ;
 * - F1 : un rôle éditable doté de « utilisateurs » ne crée pas de compte SECRETAIRE_GENERAL.
 * Base barreau_pn_test ; données marquées « E2E T9 », supprimées en afterAll (JournalAudit immuable).
 */

// F1 : on simule l'octroi de « utilisateurs » au SA dans ce fichier seulement, sans toucher la
// table RolePermission partagée avec les autres suites.
vi.mock("../src/lib/rbac.js", async (orig) => {
  const m = await orig<typeof import("../src/lib/rbac.js")>();
  return { ...m, aLaPermission: (r: string, p: string) => (r === "SECRETAIRE_ADJOINT" && p === "utilisateurs") || m.aLaPermission(r, p) };
});

import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { REFUS } from "../src/middleware/auth.js";

const app = creerApp({ anonyme: 100_000, authentifie: 100_000 });
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const SUFFIXE = String(Date.now());
const SECRET = `SECRET-T9-${SUFFIXE}`;
const jeton: Record<string, string> = {};
const ids: Record<string, number> = {};
let avant = 0;
let membreId = 0, dossierId = 0, pieceId = 0, convId = 0;
let rpAccueil: { role: string; permission: string }[] = [];

const login = async (email: string) => {
  const r = await request(app).post("/api/auth/login").send({ email, password: "barreau" });
  if (!r.body.token) throw new Error(`Connexion impossible pour ${email}`);
  return r.body.token as string;
};

/** Ligne d'audit écrite après l'envoi de la réponse (asynchrone) : sondage court. */
const ligne = async (where: Record<string, unknown>) => {
  for (let i = 0; i < 30; i++) {
    const e = await prisma.journalAudit.findFirst({ where: { id: { gt: avant }, ...where }, orderBy: { id: "desc" } });
    if (e) return e;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
};

beforeAll(async () => {
  avant = (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;
  rpAccueil = (await prisma.rolePermission.findMany({ where: { role: "ACCUEIL" } })).map(({ role, permission }) => ({ role, permission }));
  const seed: Record<string, string> = { SG: "sg", BAT: "batonnier", TRES: "tresoriere", ADM: "admin" };
  for (const [r, e] of Object.entries(seed)) {
    jeton[r] = await login(`${e}@barreau-pn.cg`);
    ids[r] = (await prisma.user.findUniqueOrThrow({ where: { email: `${e}@barreau-pn.cg` } })).id;
  }
  await prisma.user.create({
    data: { nom: "E2E T9 SA", email: `e2e-t9-sa-${SUFFIXE}@test.cg`, role: "SECRETAIRE_ADJOINT", passwordHash: bcrypt.hashSync("barreau", 4), actif: true },
  });
  jeton.SA = await login(`e2e-t9-sa-${SUFFIXE}@test.cg`);

  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  membreId = (await prisma.membre.create({ data: { num, nom: `E2E T9 ${SUFFIXE}`, qualite: "AVOCAT", statut: "INSCRIT" } })).id;
  dossierId = (await prisma.dossierDisciplinaire.create({
    data: { reference: `E2E-T9-${SUFFIXE}`, avocatNom: "E2E T9", objet: "Lecture journalisée", dateSaisine: new Date(), membreId },
  })).id;
  pieceId = (await prisma.pieceDossier.create({
    data: { membreId, type: "AUTRE", nomFichier: "e2e-t9.pdf", fichier: "e2e/t9-inexistant.pdf", mimeType: "application/pdf", taille: 1 },
  })).id;
  convId = (await prisma.conversation.create({
    data: { sujet: "E2E T9", avecAdministration: true, participants: { create: { membreId } }, messages: { create: { auteurNom: "E2E T9", corps: SECRET, auteurMembreId: membreId } } },
  })).id;
}, 60_000);

afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { id: convId } });
  await prisma.pieceDossier.deleteMany({ where: { id: pieceId } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: dossierId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "e2e-t9-", endsWith: `-${SUFFIXE}@test.cg` } } });
  // Matrice d'ACCUEIL remise à l'identique (le PUT ci-dessous la réécrit avec les mêmes droits effectifs).
  await prisma.rolePermission.deleteMany({ where: { role: "ACCUEIL" } });
  if (rpAccueil.length) await prisma.rolePermission.createMany({ data: rpAccueil as never });
  const { rafraichirMatrice } = await import("../src/lib/rbac.js");
  await rafraichirMatrice();
}, 60_000);

describe("T9 — refus 403 journalisés (D18)", () => {
  it("un POST refusé écrit « Accès refusé — Archive » attribué au refusé, sans le corps ; message neutre", async () => {
    const r = await request(app).post("/api/archives").set(...bearer(jeton.TRES)).send({ categorie: SECRET, titre: SECRET });
    expect(r.status).toBe(403);
    expect(r.body.erreur).toBe(REFUS);
    const e = await ligne({ chemin: "/api/archives", methode: "POST", userId: ids.TRES });
    expect(e?.action).toBe("Accès refusé — Archive");
    expect(e?.statut).toBe(403);
    expect(JSON.stringify(e)).not.toContain(SECRET);
    const colonnes = ["action", "cible", "chemin", "userNom"] as const;
    expect(await prisma.journalAudit.count({ where: { id: { gt: avant }, OR: colonnes.map((c) => ({ [c]: { contains: SECRET } })) } })).toBe(0);
  });

  it("un GET refusé n'est pas journalisé (pas d'inondation du journal)", async () => {
    expect((await request(app).get("/api/cotisations").set(...bearer(jeton.SA))).status).toBe(403);
    await new Promise((r) => setTimeout(r, 300));
    expect(await prisma.journalAudit.count({ where: { id: { gt: avant }, chemin: "/api/cotisations", statut: 403 } })).toBe(0);
  });

  it("PUT /rbac écrit toujours sa ligne de modification", async () => {
    const actuelles = (await request(app).get("/api/rbac").set(...bearer(jeton.SG))).body.matrice.ACCUEIL as string[];
    const r = await request(app).put("/api/rbac").set(...bearer(jeton.SG)).send({ role: "ACCUEIL", permissions: actuelles });
    expect(r.status).toBe(200);
    const e = await ligne({ chemin: "/api/rbac", methode: "PUT", userId: ids.SG, statut: 200 });
    expect(e?.action).toMatch(/^Mise à jour — /);
  });
});

describe("T9 — discipline : lectures du Bâtonnier journalisées (R-62)", () => {
  it("la lecture d'un dossier et de la liste écrit une ligne (métadonnées seules)", async () => {
    expect((await request(app).get(`/api/discipline/${dossierId}`).set(...bearer(jeton.BAT))).status).toBe(200);
    const e = await ligne({ chemin: `/api/discipline/${dossierId}`, methode: "GET", userId: ids.BAT });
    expect(e?.action).toBe("Consultation — Dossier disciplinaire");
    expect(e?.cible).toBe(`#${dossierId}`);
    expect((await request(app).get("/api/discipline").set(...bearer(jeton.BAT))).status).toBe(200);
    expect(await ligne({ chemin: "/api/discipline", methode: "GET", userId: ids.BAT })).not.toBeNull();
  });

  it("TRESORIERE : 403 sur la liste, le dossier et le casier", async () => {
    for (const url of ["/api/discipline", `/api/discipline/${dossierId}`, `/api/discipline?membreId=${membreId}`, `/api/membres/${membreId}/pieces`])
      expect((await request(app).get(url).set(...bearer(jeton.TRES))).status, url).toBe(403);
  });
});

describe("T9 — secret professionnel : l'ADMIN n'accède pas au contenu (R-58)", () => {
  it("message réel : 403 pour l'ADMIN, corps non divulgué ; le SG lit le fil", async () => {
    const r = await request(app).get(`/api/messagerie/${convId}`).set(...bearer(jeton.ADM));
    expect(r.status).toBe(403);
    expect(JSON.stringify(r.body)).not.toContain(SECRET);
    expect((await request(app).get(`/api/messagerie/${convId}`).set(...bearer(jeton.SG))).status).toBe(200);
  });

  it("pièce réelle : 403 pour l'ADMIN avant toute lecture du fichier ; le SG passe la garde", async () => {
    expect((await request(app).get(`/api/pieces/${pieceId}/fichier`).set(...bearer(jeton.ADM))).status).toBe(403);
    expect([401, 403]).not.toContain((await request(app).get(`/api/pieces/${pieceId}/fichier`).set(...bearer(jeton.SG))).status);
    // Métadonnées (liste de vérification) : droits fonctionnels de l'ADMIN conservés.
    expect((await request(app).get("/api/pieces").set(...bearer(jeton.ADM))).status).toBe(200);
  });

  it("écriture dans un fil : 403 pour l'ADMIN, aucun message ajouté", async () => {
    expect((await request(app).post(`/api/messagerie/${convId}`).set(...bearer(jeton.ADM)).send({ corps: "intrusion" })).status).toBe(403);
    expect(await prisma.message.count({ where: { conversationId: convId } })).toBe(1);
  });
});

describe("T9 — F1 : pas d'escalade vers SECRETAIRE_GENERAL", () => {
  it("un SA doté de « utilisateurs » ne crée pas de compte SG (403, aucun compte créé)", async () => {
    const email = `e2e-t9-esc-${SUFFIXE}@test.cg`;
    const r = await request(app).post("/api/users").set(...bearer(jeton.SA)).send({ nom: "E2E T9 escalade", email, role: "SECRETAIRE_GENERAL", password: "motdepasse8" });
    expect(r.status).toBe(403);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await ligne({ chemin: "/api/users", methode: "POST", statut: 403 })).not.toBeNull();
  });
});
