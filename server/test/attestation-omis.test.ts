import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { peutAttesterInscription } from "../src/lib/business.js";

/** R2-6 : l'attestation d'inscription est refusée (409) à un omis, retiré du tableau public (R1-9). */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let membreId = 0;

afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { participants: { some: { membreId } } } });
  await prisma.user.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

describe("Attestation d'inscription et statut OMIS", () => {
  it("helper : omis et sortis refusés, inscrit et suspendu admis", () => {
    for (const s of ["OMIS", "RADIE", "DECEDE", "RETRAITE"]) expect(peutAttesterInscription(s)).toBe(false);
    for (const s of ["INSCRIT", "SUSPENDU", "STAGIAIRE"]) expect(peutAttesterInscription(s)).toBe(true);
  });

  it("409 sur espace, demande, fiche et messagerie pour un omis ; non-redevance inchangée", async () => {
    const sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
    const email = `e2e.r26.${Date.now()}@barreau-pn.cg`;
    const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `E2E R26 ${Date.now()}`, qualite: "AVOCAT", email });
    membreId = m.body.id;
    const prov = await request(app).post(`/api/membres/${membreId}/acces`).set(...bearer(sg));
    await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
    const jwt = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token;
    // Demande déposée tant que le membre est inscrit, puis passage en OMIS (jeton encore valide).
    const dem = await request(app).post("/api/espace/attestations/demandes").set(...bearer(jwt)).send({ type: "INSCRIPTION" });
    expect(dem.status).toBe(201);
    await prisma.membre.update({ where: { id: membreId }, data: { statut: "OMIS" } });

    const reps = [
      await request(app).get("/api/espace/attestation/inscription/pdf").set(...bearer(jwt)),
      await request(app).post("/api/espace/attestations/demandes").set(...bearer(jwt)).send({ type: "INSCRIPTION" }),
      await request(app).post(`/api/messagerie/${dem.body.id}/attestation`).set(...bearer(sg)),
      await request(app).post(`/api/membres/${membreId}/attestation`).set(...bearer(sg)),
      await request(app).get(`/api/membres/${membreId}/attestation/pdf`).set(...bearer(sg)),
    ];
    for (const r of reps) {
      expect(r.status).toBe(409);
      expect(r.body.erreur).toMatch(/Attestation impossible/);
    }
    // La non-redevance n'affirme pas l'inscription : la demande n'est pas bloquée par ce garde.
    const nr = await request(app).post("/api/espace/attestations/demandes").set(...bearer(jwt)).send({ type: "NON_REDEVANCE" });
    expect(nr.status).toBe(201);
  });
});
