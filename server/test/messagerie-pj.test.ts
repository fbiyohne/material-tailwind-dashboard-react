import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { trouverChromium } from "../src/lib/pdf.js";
import { typeReel } from "../src/lib/storage.js";

/**
 * T13 — Messagerie : pièce jointe, empreinte, statuts reçu/lu, accusé PDF, Contacter.
 * - une pièce par message (5 Mo, PDF/DOCX/JPG/PNG vérifiés par leurs octets) ;
 * - recuAt / luAt posés une seule fois ;
 * - accusé de lecture PDF : métadonnées, empreinte, pied C-01, jamais le corps ;
 * - cloisonnement : non-participant 403, administration 404 sur un fil entre confrères ;
 * - POST /messagerie : l'administration ouvre un fil vers un membre (bouton « Contacter »).
 */
const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const PREFIXE = "E2E T13";
const crees: number[] = [];
let sg = "";
let admin = "";
let moi: { membreId: number; token: string };
let confrere: { membreId: number; token: string };
let tiers: { membreId: number; token: string };

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const EXE = Buffer.from("MZ\x90\x00\x03\x00\x00\x00ceci n'est pas un pdf");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const b64 = (b: Buffer) => b.toString("base64");

async function avocatEspace(suffixe: string) {
  const email = `e2e.t13.${suffixe}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@barreau-pn.cg`;
  const m = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${PREFIXE} ${suffixe} ${Date.now()}`, qualite: "AVOCAT", email });
  crees.push(m.body.id);
  const prov = await request(app).post(`/api/membres/${m.body.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  const token = (await request(app).post("/api/auth/login").send({ email, password: "avocatpass8" })).body.token as string;
  return { membreId: m.body.id as number, token };
}

/** Fil entre moi et le confrère, avec une pièce PDF ; renvoie {convId, messageId}. */
async function filAvecPiece(corps = "Pièce jointe de test") {
  const r = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token))
    .send({ sujet: `${PREFIXE} pièce`, corps, destinataireMembreId: confrere.membreId, piece: { nomFichier: "conclusions.pdf", donnees: b64(PDF) } });
  expect(r.status).toBe(201);
  const fil = await request(app).get(`/api/espace/messagerie/${r.body.id}`).set(...bearer(moi.token));
  return { convId: r.body.id as number, messageId: fil.body.messages[0].id as number, fil: fil.body };
}

beforeAll(async () => {
  sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
  admin = (await request(app).post("/api/auth/login").send({ email: "admin@barreau-pn.cg", password: "barreau" })).body.token;
  moi = await avocatEspace("moi");
  confrere = await avocatEspace("confrere");
  tiers = await avocatEspace("tiers");
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { membreId: { in: crees } }, select: { id: true } });
  await prisma.conversation.deleteMany({ where: { participants: { some: { membreId: { in: crees } } } } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
  await prisma.membre.deleteMany({ where: { id: { in: crees } } });
});

describe("typeReel — signature des octets", () => {
  it("reconnaît PDF, PNG, JPG, DOCX et refuse le reste", () => {
    expect(typeReel(PDF)).toBe("application/pdf");
    expect(typeReel(PNG)).toBe("image/png");
    expect(typeReel(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(typeReel(Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(30), Buffer.from("word/document.xml")]))).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(typeReel(Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.from("xl/workbook.xml")]))).toBeNull(); // zip qui n'est pas un DOCX
    expect(typeReel(EXE)).toBeNull();
    expect(typeReel(Buffer.alloc(0))).toBeNull();
  });
});

describe("Pièce jointe", () => {
  it("un exécutable renommé en .pdf est refusé (400) ; plus de 5 Mo : 413", async () => {
    const base = { sujet: `${PREFIXE} refus`, corps: "x", destinataireMembreId: confrere.membreId };
    const exe = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token)).send({ ...base, piece: { nomFichier: "virus.pdf", donnees: b64(EXE) } });
    expect(exe.status).toBe(400);
    const gros = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024, 0x41)]);
    const trop = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token)).send({ ...base, piece: { nomFichier: "gros.pdf", donnees: b64(gros) } });
    expect(trop.status).toBe(413);
    // Rien n'a été créé.
    expect(await prisma.conversation.count({ where: { sujet: `${PREFIXE} refus` } })).toBe(0);
  });

  it("une pièce valide est jointe au message : empreinte SHA-256, type réel, téléchargement réservé aux participants", async () => {
    const { messageId, fil } = await filAvecPiece();
    const m = fil.messages[0];
    expect(m.empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(m.piece).toMatchObject({ nom: "conclusions.pdf", mime: "application/pdf", taille: PDF.length });

    const dl = await request(app).get(`/api/espace/messagerie/messages/${messageId}/piece`).set(...bearer(confrere.token));
    expect(dl.status).toBe(200);
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");
    expect(dl.headers["content-type"]).toContain("application/pdf");
    expect(dl.headers["content-disposition"]).toContain('filename="conclusions.pdf"');
    expect(Buffer.from(dl.body).equals(PDF)).toBe(true);

    // Anti-IDOR : un avocat non participant reçoit 403 sur la pièce et sur l'accusé.
    expect((await request(app).get(`/api/espace/messagerie/messages/${messageId}/piece`).set(...bearer(tiers.token))).status).toBe(403);
    expect((await request(app).get(`/api/espace/messagerie/messages/${messageId}/accuse/pdf`).set(...bearer(tiers.token))).status).toBe(403);
    expect((await request(app).get(`/api/espace/messagerie/messages/999999999/piece`).set(...bearer(moi.token))).status).toBe(404);
  });

  it("le nom de fichier est assaini dans Content-Disposition", async () => {
    const r = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token))
      .send({ sujet: `${PREFIXE} nom`, corps: "x", destinataireMembreId: confrere.membreId, piece: { nomFichier: 'a"b\r\nX-Injected: 1.pdf', donnees: b64(PDF) } });
    expect(r.status).toBe(201);
    const fil = await request(app).get(`/api/espace/messagerie/${r.body.id}`).set(...bearer(moi.token));
    const dl = await request(app).get(`/api/espace/messagerie/messages/${fil.body.messages[0].id}/piece`).set(...bearer(moi.token));
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).not.toMatch(/[\r\n"]{2}/);
    expect(dl.headers["x-injected"]).toBeUndefined();
  });
  it("un nom hors Latin-1 (œ, emoji) ne fait pas échouer le téléchargement : filename ASCII + filename* UTF-8", async () => {
    const r = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token))
      .send({ sujet: `${PREFIXE} unicode`, corps: "x", destinataireMembreId: confrere.membreId, piece: { nomFichier: "Mémoire œuvre 📎.pdf", donnees: b64(PDF) } });
    const fil = await request(app).get(`/api/espace/messagerie/${r.body.id}`).set(...bearer(moi.token));
    const dl = await request(app).get(`/api/espace/messagerie/messages/${fil.body.messages[0].id}/piece`).set(...bearer(moi.token));
    expect(dl.status).toBe(200);
    expect(dl.headers["content-disposition"]).toContain(`filename*=UTF-8''${encodeURIComponent("Mémoire œuvre 📎.pdf")}`);
  });
});

describe("Statuts reçu / lu", () => {
  it("recuAt est posé au chargement de la liste, luAt à l'ouverture du fil, ni l'un ni l'autre n'est réécrit", async () => {
    const { convId, messageId } = await filAvecPiece("statuts");
    const lire = async () => prisma.message.findUniqueOrThrow({ where: { id: messageId }, select: { recuAt: true, luAt: true } });
    // L'expéditeur, qui vient de relire son fil, n'accuse pas réception de son propre message.
    expect(await lire()).toEqual({ recuAt: null, luAt: null });

    await request(app).get("/api/espace/messagerie").set(...bearer(confrere.token));
    const apresListe = await lire();
    expect(apresListe.recuAt).toBeInstanceOf(Date);
    expect(apresListe.luAt).toBeNull();

    await new Promise((r) => setTimeout(r, 20));
    const fil = await request(app).get(`/api/espace/messagerie/${convId}`).set(...bearer(confrere.token));
    const apresOuverture = await lire();
    expect(apresOuverture.recuAt!.getTime()).toBe(apresListe.recuAt!.getTime());
    expect(apresOuverture.luAt).toBeInstanceOf(Date);
    expect(fil.body.messages[0]).toMatchObject({ recuAt: apresListe.recuAt!.toISOString(), luAt: apresOuverture.luAt!.toISOString() });

    await new Promise((r) => setTimeout(r, 20));
    await request(app).get("/api/espace/messagerie").set(...bearer(confrere.token));
    await request(app).get(`/api/espace/messagerie/${convId}`).set(...bearer(confrere.token));
    expect(await lire()).toEqual(apresOuverture);
  });

  it("côté administration : la liste pose recuAt, le fil pose luAt sur les messages de l'avocat ; une réponse admin est reçue/lue par l'avocat", async () => {
    const r = await request(app).post("/api/espace/messagerie").set(...bearer(moi.token)).send({ sujet: `${PREFIXE} admin`, corps: "question", avecAdministration: true });
    const convId = r.body.id as number;
    const msg = await prisma.message.findFirstOrThrow({ where: { conversationId: convId } });
    await request(app).get("/api/messagerie").set(...bearer(sg));
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).recuAt).toBeInstanceOf(Date);
    await request(app).get(`/api/messagerie/${convId}`).set(...bearer(sg));
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).luAt).toBeInstanceOf(Date);

    const rep = await request(app).post(`/api/messagerie/${convId}`).set(...bearer(sg)).send({ corps: "réponse", piece: { nomFichier: "photo.png", donnees: b64(PNG) } });
    expect(rep.status).toBe(201);
    // L'administration qui relit son fil n'accuse pas réception de sa propre réponse.
    await request(app).get(`/api/messagerie/${convId}`).set(...bearer(sg));
    expect((await prisma.message.findUniqueOrThrow({ where: { id: rep.body.id } })).recuAt).toBeNull();
    await request(app).get(`/api/espace/messagerie/${convId}`).set(...bearer(moi.token));
    const lu = await prisma.message.findUniqueOrThrow({ where: { id: rep.body.id } });
    expect(lu.recuAt).toBeInstanceOf(Date);
    expect(lu.luAt).toBeInstanceOf(Date);
    // La pièce de l'administration est lisible par l'avocat participant et par l'administration.
    expect((await request(app).get(`/api/espace/messagerie/messages/${rep.body.id}/piece`).set(...bearer(moi.token))).status).toBe(200);
    expect((await request(app).get(`/api/messagerie/messages/${rep.body.id}/piece`).set(...bearer(sg))).status).toBe(200);
  });
});

describe("Accusé de lecture PDF", () => {
  const aPdftotext = !spawnSync("pdftotext", ["-v"]).error;
  const texteDe = (pdf: Buffer) => {
    const f = join(tmpdir(), `t13-${process.pid}-${Date.now()}.pdf`);
    writeFileSync(f, pdf);
    try { return spawnSync("pdftotext", ["-enc", "UTF-8", f, "-"], { encoding: "utf8" }).stdout.replace(/\s+/g, " "); } finally { rmSync(f, { force: true }); }
  };

  it.skipIf(!trouverChromium() || !aPdftotext)("le texte extrait contient l'empreinte et le pied C-01, sans le corps du message", async () => {
    const SECRET = "ZEBRE-SECRET-7731";
    const { convId, messageId, fil } = await filAvecPiece(`Corps confidentiel ${SECRET}`);
    await request(app).get(`/api/espace/messagerie/${convId}`).set(...bearer(confrere.token)); // pose reçu + lu
    const r = await request(app).get(`/api/espace/messagerie/messages/${messageId}/accuse/pdf`).set(...bearer(moi.token)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []; res.on("data", (c) => chunks.push(c)); res.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    const texte = texteDe(r.body as Buffer);
    expect(texte).toContain("Accusé de lecture de la plateforme");
    expect(texte).toContain(fil.messages[0].empreinte);
    expect(texte).toContain("Il ne vaut ni lettre recommandée ni notification au sens des articles 39 et 42 de la loi n° 026-92 du 20 août 1992. Valeur probatoire à confirmer.");
    expect(texte).not.toContain("Barreau de Barreau"); // « Barreau [nom] » de C-01 = dénomination paramétrée, sans doublon
    expect(texte).toContain("conclusions.pdf");
    expect(texte).toContain("Première ouverture");
    expect(texte).not.toContain(SECRET);
    // L'accusé est aussi accessible au destinataire participant.
    expect((await request(app).get(`/api/espace/messagerie/messages/${messageId}/accuse/pdf`).set(...bearer(confrere.token))).status).toBe(200);
  });
});

describe("Cloisonnement de l'administration (R-58)", () => {
  it("l'administration ne lit ni un fil entre confrères, ni sa pièce, ni son accusé (404) ; l'ADMIN n'a pas accès au contenu (403)", async () => {
    const { convId, messageId } = await filAvecPiece("secret entre confrères");
    expect((await request(app).get(`/api/messagerie/${convId}`).set(...bearer(sg))).status).toBe(404);
    expect((await request(app).get(`/api/messagerie/messages/${messageId}/piece`).set(...bearer(sg))).status).toBe(404);
    expect((await request(app).get(`/api/messagerie/messages/${messageId}/accuse/pdf`).set(...bearer(admin))).status).toBe(404);
    const liste = await request(app).get("/api/messagerie").set(...bearer(sg));
    expect(liste.body.map((c: { id: number }) => c.id)).not.toContain(convId);
    // Secret professionnel (R-58, loi 026-92 art. 52) : l'ADMIN, sous-traitant technique, est refusé sur le contenu.
    for (const url of [`/api/messagerie/${convId}`, `/api/messagerie/messages/${messageId}/piece`, "/api/messagerie"])
      expect((await request(app).get(url).set(...bearer(admin))).status, url).toBe(403);
  });
});

describe("POST /messagerie — Contacter un membre depuis sa fiche", () => {
  it("ouvre un fil administration → membre, visible dans l'espace ; tracé sans le corps ; radié : 409 ; inexistant : 404", async () => {
    const corps = `Bonjour Maître, merci de passer au secrétariat. CODE-${Date.now()}`;
    const r = await request(app).post("/api/messagerie").set(...bearer(sg)).send({ membreId: moi.membreId, sujet: `${PREFIXE} contact`, corps });
    expect(r.status).toBe(201);
    const fil = await request(app).get(`/api/espace/messagerie/${r.body.id}`).set(...bearer(moi.token));
    expect(fil.status).toBe(200);
    expect(fil.body.avecAdministration).toBe(true);
    expect(fil.body.messages[0]).toMatchObject({ corps, estAdministration: true, estMoi: false });
    // Côté administration le fil est dans la boîte et déjà lu (c'est elle qui l'a écrit).
    const boite = await request(app).get("/api/messagerie").set(...bearer(sg));
    expect(boite.body.find((c: { id: number }) => c.id === r.body.id)?.nonLus).toBe(0);
    // Journal : identifiant du message, jamais le corps (CA10).
    const lignes = await prisma.journalAudit.findMany({ where: { chemin: "/api/messagerie", methode: "POST" }, orderBy: { id: "desc" }, take: 3 });
    expect(lignes.some((l) => l.action.includes(`message #${fil.body.messages[0].id}`))).toBe(true);
    expect(JSON.stringify(lignes)).not.toContain("CODE-");

    const radie = await prisma.membre.create({ data: { num: ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 1, nom: `${PREFIXE} radie`, qualite: "AVOCAT", statut: "RADIE" } });
    crees.push(radie.id);
    expect((await request(app).post("/api/messagerie").set(...bearer(sg)).send({ membreId: radie.id, sujet: "x", corps: "y" })).status).toBe(409);
    expect((await request(app).post("/api/messagerie").set(...bearer(sg)).send({ membreId: 999999999, sujet: "x", corps: "y" })).status).toBe(404);
    expect((await request(app).post("/api/messagerie").set(...bearer(moi.token)).send({ membreId: confrere.membreId, sujet: "x", corps: "y" })).status).toBe(403);
  });
});

describe("F-36 — POST /espace/pieces vérifie le type réel", () => {
  it("un exécutable déclaré PDF est refusé (400) ; un vrai PDF est accepté avec son type réel", async () => {
    const exe = await request(app).post("/api/espace/pieces").set(...bearer(moi.token)).send({ type: "AUTRE", nomFichier: "piece.pdf", mimeType: "application/pdf", donnees: b64(EXE) });
    expect(exe.status).toBe(400);
    const ok = await request(app).post("/api/espace/pieces").set(...bearer(moi.token)).send({ type: "AUTRE", nomFichier: "piece.pdf", mimeType: "text/html", donnees: b64(PDF) });
    expect(ok.status).toBe(201);
    const piece = await prisma.pieceDossier.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(piece.mimeType).toBe("application/pdf");
    await prisma.pieceDossier.delete({ where: { id: piece.id } });
  });
});
