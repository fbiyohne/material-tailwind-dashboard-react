import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

// T15 — rejet de pièce motivé (3 à 500 car.) et notification de l'avocat (parcours 9).
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let membreId = 0;
let userId = 0;
const ids: number[] = [];

const nouvellePiece = async () => {
  const p = await prisma.pieceDossier.create({
    data: { membreId, type: "IDENTITE", nomFichier: "cni.pdf", fichier: "inexistant/cni.pdf", mimeType: "application/pdf", taille: 10 },
  });
  ids.push(p.id);
  return p.id;
};
const notifs = () => prisma.notification.findMany({ where: { userId }, orderBy: { id: "desc" } });

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  // num = max(num) + 1 (comme POST /membres) : aucune collision avec un reste de test,
  // la suite étant sérialisée par le verrou consultatif de globalSetup.
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1;
  const m = await prisma.membre.create({ data: { num, nom: `REJET PIECE ${num}`, qualite: "AVOCAT" } as never });
  membreId = m.id;
  const u = await prisma.user.create({
    data: { nom: m.nom, email: `rejet${num}@test.cg`, role: "AVOCAT", passwordHash: "x", actif: true, membreId },
  });
  userId = u.id;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.pieceDossier.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("Pièces — rejet motivé et notifié", () => {
  it("rejet sans motif ou motif trop court / trop long : 400, pièce inchangée", async () => {
    const id = await nouvellePiece();
    for (const corps of [{}, { note: "" }, { note: "ab" }, { note: "x".repeat(501) }]) {
      expect((await request(app).post(`/api/pieces/${id}/rejeter`).set(...bearer(sg)).send(corps)).status).toBe(400);
    }
    expect((await prisma.pieceDossier.findUnique({ where: { id } }))?.statut).toBe("A_VERIFIER");
  });

  it("rejet avec motif : pièce REJETEE et notification (motif inclus) pour l'avocat", async () => {
    const id = await nouvellePiece();
    const r = await request(app).post(`/api/pieces/${id}/rejeter`).set(...bearer(sg)).send({ note: "Scan illisible, merci de redéposer" });
    expect(r.status).toBe(200);
    expect(r.body.statut).toBe("REJETEE");
    await expect.poll(async () => (await notifs()).length).toBe(1);
    const n = (await notifs())[0];
    expect(n.type).toBe("PIECE_REJETEE");
    expect(n.message).toContain("Scan illisible");
  });

  it("vérification : l'avocat est notifié", async () => {
    const id = await nouvellePiece();
    expect((await request(app).post(`/api/pieces/${id}/verifier`).set(...bearer(sg))).status).toBe(200);
    await expect.poll(async () => (await notifs()).some((n) => n.type === "PIECE_VERIFIEE")).toBe(true);
  });
});
