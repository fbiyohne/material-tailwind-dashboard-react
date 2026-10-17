import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";

/**
 * R2-5 — annulation LOGIQUE d'un reçu (avis juridique : aucun reçu émis ne s'efface,
 * numérotation continue sans trou). DELETE /recus/:id passe le reçu à ANNULE (date,
 * motif, acteur), décrémente le paiement une seule fois, conserve l'archive, et la
 * page publique /v/r/... répond « Document annulé » au lieu de « Non reconnu ».
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
let sg = "";
let sgId = 0;
let membreId = 0;
const MONTANT = 1000;

beforeAll(async () => {
  const login = await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" });
  sg = login.body.token;
  sgId = login.body.user.id;
  const num = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1000;
  membreId = (await prisma.membre.create({ data: { num, nom: `E2E R25 ${num}`, qualite: "AVOCAT", statut: "INSCRIT", dateInscription: new Date("2015-01-10") } as never })).id;
});

afterAll(async () => {
  const numeros = (await prisma.recu.findMany({ where: { membreId }, select: { numero: true } })).map((r) => r.numero);
  await prisma.archive.deleteMany({ where: { reference: { in: numeros } } });
  await prisma.cotisation.deleteMany({ where: { membreId } });
  await prisma.recu.deleteMany({ where: { membreId } });
  await prisma.membre.deleteMany({ where: { id: membreId } });
});

const payer = async () => {
  const p = await request(app).post("/api/cotisations/paiement").set(...bearer(sg)).send({ membreId, annee: 2026, montant: MONTANT, mode: "Espèces" });
  expect(p.status).toBe(201);
  return p.body.recu as { id: number; numero: string; verif: string };
};
const paye = async () => (await prisma.cotisation.findUnique({ where: { membreId_annee: { membreId, annee: 2026 } } }))?.montantPaye;

describe("R2-5 — annulation logique d'un reçu", () => {
  it("le reçu reste en base (ANNULE, date, motif, acteur), le paiement est décrémenté une seule fois", async () => {
    const r1 = await payer();
    await payer();
    expect(await paye()).toBe(2 * MONTANT);

    const d = await request(app).delete(`/api/recus/${r1.id}`).set(...bearer(sg)).send({ motif: "Saisie en double" });
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ ok: true, annule: r1.numero });

    const enBase = await prisma.recu.findUnique({ where: { id: r1.id } });
    expect(enBase).not.toBeNull();
    expect(enBase).toMatchObject({ statut: "ANNULE", motifAnnulation: "Saisie en double", annuleParId: sgId });
    expect(enBase!.annuleLe).toBeInstanceOf(Date);
    expect(await paye()).toBe(MONTANT);

    // Double appel : idempotent, aucune seconde décrémentation.
    const d2 = await request(app).delete(`/api/recus/${r1.id}`).set(...bearer(sg));
    expect(d2.status).toBe(200);
    expect(d2.body).toMatchObject({ ok: true, annule: r1.numero, dejaAnnule: true });
    expect(await paye()).toBe(MONTANT);
    expect((await prisma.recu.findUnique({ where: { id: r1.id } }))!.motifAnnulation).toBe("Saisie en double");

    // Archive conservée et marquée annulée.
    const archive = await prisma.archive.findFirst({ where: { categorie: "Reçu de paiement", reference: r1.numero } });
    expect(archive?.titre).toMatch(/annulé/i);

    // Registre : le reçu figure avec son statut ; PDF refusé (plus de pièce « valide » réimprimable).
    const liste = await request(app).get("/api/recus?annee=2026").set(...bearer(sg));
    expect(liste.body.find((r: { id: number }) => r.id === r1.id)?.statut).toBe("ANNULE");
    expect((await request(app).get(`/api/recus/${r1.id}/pdf`).set(...bearer(sg))).status).toBe(409);
  });

  it("motif par défaut quand aucun n'est fourni", async () => {
    const r = await payer();
    expect((await request(app).delete(`/api/recus/${r.id}`).set(...bearer(sg))).status).toBe(200);
    expect((await prisma.recu.findUnique({ where: { id: r.id } }))!.motifAnnulation).toBeTruthy();
  });

  it("/v/r/... d'un reçu annulé répond « Document annulé », jamais « Authentique » ni « Non reconnu »", async () => {
    const r = await payer();
    expect((await request(app).get(new URL(r.verif, "http://x").pathname)).text).toContain("Authentique");
    await request(app).delete(`/api/recus/${r.id}`).set(...bearer(sg));
    const v = await request(app).get(new URL(r.verif, "http://x").pathname);
    expect(v.status).toBe(200);
    expect(v.text).toContain("Document annulé");
    expect(v.text).not.toContain("Authentique");
    expect(v.text).not.toContain("Non reconnu");
  });

  it("ancienne voie /api/verifier/recu : un reçu antérieur à la bascule et annulé n'est plus valide", async () => {
    const r = await payer();
    await prisma.recu.update({ where: { id: r.id }, data: { createdAt: new Date("2026-01-01") } });
    expect((await request(app).get(`/api/verifier/recu/${r.numero}`)).body.valide).toBe(true);
    await request(app).delete(`/api/recus/${r.id}`).set(...bearer(sg));
    const v = await request(app).get(`/api/verifier/recu/${r.numero}`);
    expect(v.body).toMatchObject({ valide: false, motif: "annulé" });
  });
});
