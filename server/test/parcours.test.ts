import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { trouverChromium } from "../src/lib/pdf.js";
import { rafraichirIdentite } from "../src/lib/identiteDocuments.js";
import { recuRicheHtml } from "../src/lib/documentsRiches.js";
import { tableauOrdreHtml } from "../src/lib/templates.js";
import { cotisationDue, tarifsActuels } from "../src/lib/business.js";

/**
 * T26 — Recette API des 12 parcours du §5 du cahier de mission (CA5), de bout en bout
 * sur barreau_pn_test : un describe par parcours, uniquement par les routes HTTP
 * (supertest), comme le ferait l'interface. Relance :
 *   cd server && npx vitest run test/parcours.test.ts
 * Les volets PDF (accusé, reçu, tableau) exigent Chromium et pdftotext ; ils sont
 * sautés (et signalés) s'ils manquent.
 * Fixtures : noms préfixés « E2E PARCOURS » (purgeables par prisma/purger-restes-tests.ts),
 * Paramètres sauvegardés puis restaurés.
 */

// Parcours 7 : on écoute le signal temps réel « tableau » émis par changerSituation (D16).
const signaux = vi.hoisted(() => [] as { type: string }[]);
vi.mock("../src/lib/realtime.js", async (original) => {
  const mod = await original<typeof import("../src/lib/realtime.js")>();
  return { ...mod, realtimeTous: (evt: Parameters<typeof mod.realtimeTous>[0]) => { signaux.push(evt); mod.realtimeTous(evt); } };
});

const app = creerApp();
const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
const PREFIXE = "E2E PARCOURS";
const marque = Date.now();
const login = async (email: string, password = "barreau") =>
  (await request(app).post("/api/auth/login").send({ email, password })).body.token as string;
const jour = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
const binaire = (res: NodeJS.ReadableStream, cb: (e: Error | null, b: Buffer) => void) => {
  const c: Buffer[] = []; res.on("data", (x: Buffer) => c.push(x)); res.on("end", () => cb(null, Buffer.concat(c)));
};
const aPdf = !!trouverChromium() && !spawnSync("pdftotext", ["-v"]).error;
const textePdf = (pdf: Buffer) => {
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  const f = join(tmpdir(), `parcours-${process.pid}-${Date.now()}.pdf`);
  writeFileSync(f, pdf);
  try { return spawnSync("pdftotext", ["-enc", "UTF-8", f, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout.replace(/\s+/g, " "); } finally { rmSync(f, { force: true }); }
};
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const b64 = (b: Buffer) => b.toString("base64");

let sg = "", bat = "", tr = "", admin = "";
let sgId = 0;
let sauvegarde: unknown = null;
let numBase = 0;
const dossiers: number[] = [];
const scrutins: number[] = [];

async function creerMembre(nom: string, extra: Record<string, unknown> = {}) {
  const r = await request(app).post("/api/membres").set(...bearer(sg)).send({ nom: `${PREFIXE} ${nom} ${marque}`, qualite: "AVOCAT", ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: number; num: number; nom: string; numInscription: string };
}
/** Avocat doté d'un accès à l'espace (provisionnement puis activation, comme en production). */
async function avocatEspace(nom: string) {
  const email = `e2e.parcours.${nom.toLowerCase().replace(/[^a-z0-9]/g, "")}.${marque}.${Math.random().toString(36).slice(2, 7)}@barreau-pn.cg`;
  const m = await creerMembre(nom, { email });
  const prov = await request(app).post(`/api/membres/${m.id}/acces`).set(...bearer(sg));
  await request(app).post("/api/auth/activer").send({ token: prov.body.lien.split("/activer/")[1], password: "avocatpass8" });
  return { ...m, token: await login(email, "avocatpass8") };
}
const ouvrirDossier = async (membreId: number) => {
  const d = await request(app).post("/api/discipline").set(...bearer(sg)).send({ membreId, avocatNom: `Me ${PREFIXE}`, objet: "Manquement déontologique (recette)" });
  expect(d.status).toBe(201);
  dossiers.push(d.body.id);
  return d.body as { id: number; reference: string };
};
const decider = (id: number, jeton: string, corps: Record<string, unknown>) =>
  request(app).post(`/api/discipline/${id}/decision`).set(...bearer(jeton)).send({ motivation: "Motivation du conseil de discipline (recette).", ...corps });
const tableau = async () => {
  const t = await request(app).get("/api/tableau").set(...bearer(sg));
  expect(t.status).toBe(200);
  return t.body as { miseAJour: string; sections: { qualite: string; membres: { id: number; nom: string; rang: number; statut: string }[] }[] };
};
const section = (t: Awaited<ReturnType<typeof tableau>>, q: string) => t.sections.find((s) => s.qualite === q)?.membres ?? [];
const auTableau = async (id: number) => (await tableau()).sections.some((s) => s.membres.some((m) => m.id === id));
const statutDe = async (id: number) => (await prisma.membre.findUniqueOrThrow({ where: { id } })).statut;
/** Ligne de JournalAudit écrite après la réponse (middleware asynchrone). */
async function ligneAudit(where: Record<string, unknown>, depuis: number) {
  for (let i = 0; i < 40; i++) {
    const e = await prisma.journalAudit.findFirst({ where: { id: { gt: depuis }, ...where }, orderBy: { id: "desc" } });
    if (e) return e;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}
const maxAudit = async () => (await prisma.journalAudit.aggregate({ _max: { id: true } }))._max.id ?? 0;

beforeAll(async () => {
  [sg, bat, tr, admin] = await Promise.all(["sg@barreau-pn.cg", "batonnier@barreau-pn.cg", "tresoriere@barreau-pn.cg", "admin@barreau-pn.cg"].map((e) => login(e)));
  sgId = (await prisma.user.findUniqueOrThrow({ where: { email: "sg@barreau-pn.cg" } })).id;
  sauvegarde = (await prisma.parametres.findUnique({ where: { id: 1 } }))?.data ?? null;
  // Plage de num pour l'import, au-delà du maximum présent (base partagée, restes de tests).
  numBase = ((await prisma.membre.aggregate({ _max: { num: true } }))._max.num ?? 0) + 500;
}, 60_000);

afterAll(async () => {
  if (sauvegarde) await prisma.parametres.update({ where: { id: 1 }, data: { data: sauvegarde as object } });
  await rafraichirIdentite();
  const mes = { membre: { nom: { startsWith: PREFIXE } } };
  const ids = (await prisma.membre.findMany({ where: { nom: { startsWith: PREFIXE } }, select: { id: true } })).map((m) => m.id);
  await prisma.scrutin.deleteMany({ where: { id: { in: scrutins } } });
  await prisma.dossierDisciplinaire.deleteMany({ where: { id: { in: dossiers } } });
  await prisma.conversation.deleteMany({ where: { participants: { some: { membreId: { in: ids } } } } });
  await prisma.archive.deleteMany({ where: { membreNom: { startsWith: PREFIXE } } });
  await prisma.user.deleteMany({ where: { membreId: { in: ids } } }); // notifications en cascade
  await prisma.recu.deleteMany({ where: mes });
  await prisma.paiement.deleteMany({ where: mes });
  await prisma.quitus.deleteMany({ where: mes });
  await prisma.membre.deleteMany({ where: { id: { in: ids } } }); // événements, cotisations, pièces en cascade
}, 60_000);

describe("Parcours 1 — import d'une liste tableau et d'une liste de stagiaires, avec erreurs volontaires", () => {
  it("aperçu sans écriture, erreurs ligne par ligne et doublons, puis import réel dans deux listes distinctes", async () => {
    const n = (i: number) => numBase + i;
    const tableauRows = [
      { num: n(1), nom: `${PREFIXE} Import Alpha ${marque}`, dateInscription: "12/03/2019", cabinet: "Cabinet Recette" },
      { num: n(2), nom: `${PREFIXE} Import Beta ${marque}`, statut: "Inscritt" }, // statut inconnu
      { num: "abc", nom: `${PREFIXE} Import Gamma ${marque}` }, // num invalide
      { num: n(1), nom: `${PREFIXE} Import Delta ${marque}` }, // doublon de num dans le fichier
    ];
    const stagiairesRows = [
      { num: n(11), nom: `${PREFIXE} Import Stagiaire Un ${marque}` },
      { num: n(12), nom: `${PREFIXE} Stagiaire Import Un ${marque}` }, // même nom, mots permutés
    ];
    const importer = (membres: unknown[], qualiteDefaut: string, simulation: boolean) =>
      request(app).post(`/api/membres/import${simulation ? "?simulation=1" : ""}`).set(...bearer(sg)).send({ membres, qualiteDefaut });

    const avant = await prisma.membre.count();
    const apercu = await importer(tableauRows, "AVOCAT", true);
    expect(apercu.status).toBe(200);
    expect(apercu.body.simulation).toBe(true);
    expect(await prisma.membre.count()).toBe(avant); // annulation au stade de l'aperçu : rien n'est écrit
    expect(apercu.body.erreurs.map((e: { ligne: number }) => e.ligne).sort()).toEqual([2, 3]);
    expect(apercu.body.erreurs.find((e: { ligne: number }) => e.ligne === 2).message).toMatch(/Statut inconnu/);
    expect(apercu.body.doublons).toEqual(expect.arrayContaining([expect.objectContaining({ type: "num", avec: "fichier", ligne: 4 })]));
    const apercuStage = await importer(stagiairesRows, "STAGIAIRE", true);
    expect(apercuStage.body.doublons).toEqual(expect.arrayContaining([expect.objectContaining({ type: "nom", avec: "fichier", ligne: 2 })]));

    // Validation : l'utilisateur retire les lignes fautives et confirme.
    const r1 = await importer([tableauRows[0]], "AVOCAT", false);
    const r2 = await importer([stagiairesRows[0]], "STAGIAIRE", false);
    expect([r1.body.crees, r2.body.crees, r1.body.erreurs.length, r2.body.erreurs.length]).toEqual([1, 1, 0, 0]);

    const liste = async (qualite: string) =>
      (await request(app).get("/api/membres").query({ q: `${PREFIXE} Import`, qualite, pageSize: 50 }).set(...bearer(sg))).body.items.map((m: { num: number }) => m.num);
    expect(await liste("AVOCAT")).toEqual([n(1)]);
    expect(await liste("STAGIAIRE")).toEqual([n(11)]);
    const alpha = await prisma.membre.findUniqueOrThrow({ where: { num: n(1) } });
    expect(alpha).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT", cabinet: "Cabinet Recette" });
    expect(jour(alpha.dateInscription!)).toBe("2019-03-12"); // JJ/MM/AAAA lu à la française
    expect((await prisma.membre.findUniqueOrThrow({ where: { num: n(11) } })).statut).toBe("STAGIAIRE");
  });
});

describe("Parcours 2 — passage d'un stagiaire au tableau depuis sa fiche, sans réimport", () => {
  it("le stagiaire quitte la liste du stage et figure parmi les dernières inscriptions du tableau", async () => {
    const s = await creerMembre("Stagiaire Passage", { qualite: "STAGIAIRE", statut: "STAGIAIRE", dateInscription: "2023-11-02" });
    const stage = () => request(app).get("/api/membres").query({ q: s.nom, qualite: "STAGIAIRE" }).set(...bearer(sg));
    expect((await stage()).body.items.map((m: { id: number }) => m.id)).toEqual([s.id]);

    const r = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat)).send({ dateDemande: "2026-01-15" }); // décision du jour (défaut)
    expect(r.status).toBe(200);
    // Même fiche (id, num, n° d'inscription) : aucun réimport.
    expect(r.body).toMatchObject({ id: s.id, num: s.num, numInscription: s.numInscription, qualite: "AVOCAT", statut: "INSCRIT" });
    expect(jour(r.body.dateInscription)).toBe(jour(new Date()));
    expect((await stage()).body.items).toHaveLength(0);

    const recents = await request(app).get("/api/membres").query({ qualite: "AVOCAT", sort: "dateInscription", order: "desc", pageSize: 50 }).set(...bearer(sg));
    expect(recents.status).toBe(200);
    expect(recents.body.items.map((m: { id: number }) => m.id)).toContain(s.id);
    // Les fiches sans date d'inscription ne passent pas devant les inscriptions récentes (nulls last).
    expect(recents.body.items[0].dateInscription).not.toBeNull();

    const t = await tableau();
    expect(section(t, "STAGIAIRE").some((m) => m.id === s.id)).toBe(false);
    const avocats = section(t, "AVOCAT");
    // Ordre d'ancienneté : parmi les fiches datées, l'avocat figure en fin de tableau
    // (les fiches sans date d'inscription, restes de tests, sont rangées après).
    const dates = avocats.filter((m) => (m as { dateInscription?: string }).dateInscription);
    expect(dates.findIndex((m) => m.id === s.id)).toBeGreaterThanOrEqual(dates.length - 50);
    const h = await request(app).get(`/api/membres/${s.id}/evenements`).set(...bearer(sg));
    expect(h.body[0]).toMatchObject({ type: "PASSAGE_TABLEAU", statutAvant: "STAGIAIRE", statutApres: "INSCRIT" });
  });
});

describe("Parcours 3 — admission directe d'un avocat au tableau (cas dérogatoire)", () => {
  it("cas hors catalogue refusé ; cas prévu : avocat INSCRIT au tableau, jamais passé par le stage", async () => {
    const corps = { nom: `${PREFIXE} Admission ${marque}`, cas: "MAGISTRAT", ancienneteAns: 7, reference: "DELIB-CO-2026-11", dateDecision: "2026-04-02" };
    expect((await request(app).post("/api/membres/admission-directe").set(...bearer(bat)).send({ ...corps, cas: "HUISSIER" })).status).toBe(400);
    expect((await request(app).post("/api/membres/admission-directe").set(...bearer(tr)).send(corps)).status).toBe(403);
    const r = await request(app).post("/api/membres/admission-directe").set(...bearer(bat)).send(corps);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ qualite: "AVOCAT", statut: "INSCRIT" });
    expect(jour(r.body.dateInscription)).toBe("2026-04-02");
    expect(section(await tableau(), "AVOCAT").some((m) => m.id === r.body.id)).toBe(true);
    const h = (await request(app).get(`/api/membres/${r.body.id}/evenements`).set(...bearer(sg))).body;
    expect(h.map((e: { type: string }) => e.type)).toEqual(["ADMISSION_DIRECTE"]);
    expect(h[0]).toMatchObject({ reference: "DELIB-CO-2026-11", details: expect.objectContaining({ cas: "MAGISTRAT" }) });
  });
});

describe("Parcours 4 — impayés vers omission : rappel, mise en demeure, transmission, omission (CA7)", () => {
  it("omission seulement après les trois étapes, distincte de la radiation, levée par réinscription", async () => {
    const m = await creerMembre("Impayes");
    const evt = (jeton: string, corps: Record<string, unknown>) => request(app).post(`/api/membres/${m.id}/evenements`).set(...bearer(jeton)).send(corps);
    const omission = { type: "OMISSION", dateEffet: "2026-03-20", annee: 2026, reference: "CNO-2026-090" };

    expect((await evt(bat, omission)).status).toBe(409); // aucune étape
    expect((await evt(tr, { type: "RAPPEL", dateEffet: "2026-01-05", annee: 2026 })).status).toBe(201);
    expect((await evt(bat, omission)).status).toBe(409); // étapes incomplètes
    expect((await evt(tr, { type: "MISE_EN_DEMEURE", dateEffet: "2026-02-10", annee: 2026 })).status).toBe(201);
    expect((await evt(tr, { type: "TRANSMISSION", dateEffet: "2026-03-02", annee: 2026 })).status).toBe(201);
    expect((await evt(sg, omission)).status).toBe(403); // enregistrement réservé (omission_prononcer)
    const o = await evt(bat, omission);
    expect(o.status).toBe(201);
    expect(o.body.membre).toMatchObject({ statut: "OMIS", dateRadiation: null, motifRadiation: null });
    expect(o.body.evenement.details.organe).toMatch(/Conseil de l'Ordre national/);

    // Distincte de la radiation : statut, libellé, absence de date de radiation ; hors annuaire des confrères.
    expect(await statutDe(m.id)).not.toBe("RADIE");
    expect((await request(app).get("/api/membres").query({ statut: "RADIE", q: m.nom }).set(...bearer(sg))).body.items).toHaveLength(0);
    expect((await request(app).get("/api/membres").query({ statut: "OMIS", q: m.nom }).set(...bearer(sg))).body.items.map((x: { id: number }) => x.id)).toEqual([m.id]);

    // Temporaire : réinscription par décision référencée.
    const r = await evt(bat, { type: "REINSCRIPTION", dateEffet: "2026-06-01", reference: "CNO-2026-120" });
    expect(r.status).toBe(201);
    expect(r.body.membre.statut).toBe("INSCRIT");
    const h = (await request(app).get(`/api/membres/${m.id}/evenements`).set(...bearer(sg))).body;
    expect(h.map((e: { type: string }) => e.type)).toEqual(["REINSCRIPTION", "OMISSION", "TRANSMISSION", "MISE_EN_DEMEURE", "RAPPEL"]);
    expect(h.every((e: { dateEffet: string; createdAt: string }) => e.dateEffet && e.createdAt)).toBe(true); // horodaté
  });
});

describe("Parcours 5 — dossier disciplinaire complet : sursis (reste au tableau) puis radiation (CA6)", () => {
  it("saisine → rapporteur → rapport → poursuite → juridiction → décision ; sursis puis radiation répercutés", async () => {
    const m = await creerMembre("Discipline");
    const d = await ouvrirDossier(m.id);
    const patch = (corps: Record<string, unknown>) => request(app).patch(`/api/discipline/${d.id}`).set(...bearer(sg)).send(corps);
    expect((await patch({ statut: "INSTRUCTION", rapporteur: "Me Enquêteur Recette", dateDesignationRapporteur: "2026-02-01" })).status).toBe(200);
    expect((await patch({ dateRapport: "2026-03-01", conclusionRapport: "Faits établis." })).status).toBe(200);
    expect((await patch({ orientation: "POURSUITE", juridiction: "Conseil de discipline", statut: "AUDIENCE", dateAudience: "2026-03-20" })).status).toBe(200);

    // Le SG instruit mais n'enregistre pas la décision (CA6).
    expect((await decider(d.id, sg, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 6, sursis: true })).status).toBe(403);
    const sursis = await decider(d.id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 6, sursis: true, dateDecision: "2026-04-01", reference: "CD-2026-R1" });
    expect(sursis.status).toBe(200);
    const dossier = (await request(app).get(`/api/discipline/${d.id}`).set(...bearer(bat))).body;
    expect(dossier).toMatchObject({
      rapporteur: "Me Enquêteur Recette", orientation: "POURSUITE", juridiction: "Conseil de discipline",
      sanctionCode: "INTERDICTION_TEMPORAIRE", sursis: true, statut: "DECISION", sanction: "Interdiction temporaire (6 mois, avec sursis)",
    });
    expect(dossier.decidePar).toMatch(/Conseil de discipline/);
    // Avec sursis : reste INSCRIT, au tableau et dans le PDF du tableau, mention sur la fiche.
    expect(await statutDe(m.id)).toBe("INSCRIT");
    const t = await tableau();
    expect(section(t, "AVOCAT").some((x) => x.id === m.id)).toBe(true);
    expect(tableauOrdreHtml(t.sections as never, new Date())).toContain(m.nom); // même gabarit que GET /tableau/pdf
    const h = (await request(app).get(`/api/membres/${m.id}/evenements`).set(...bearer(sg))).body;
    expect(h[0]).toMatchObject({ type: "SANCTION", statutApres: "INSCRIT" });
    expect(h[0].motif).toContain("avec sursis");

    // Second dossier jusqu'à la radiation enregistrée : RADIE, hors tableau, PDF et annuaire, sans autre saisie.
    const d2 = await ouvrirDossier(m.id);
    const rad = await decider(d2.id, bat, { sanctionCode: "RADIATION", dateDecision: "2026-05-15", reference: "CD-2026-R2" });
    expect(rad.status).toBe(200);
    const fiche = (await request(app).get(`/api/membres/${m.id}`).set(...bearer(sg))).body;
    expect(fiche.statut).toBe("RADIE");
    expect(jour(fiche.dateRadiation)).toBe("2026-05-15");
    const t2 = await tableau();
    expect(t2.sections.some((s) => s.membres.some((x) => x.id === m.id))).toBe(false);
    expect(tableauOrdreHtml(t2.sections as never, new Date())).not.toContain(m.nom);
    const lecteur = await avocatEspace("Lecteur");
    const annuaire = await request(app).get("/api/espace/annuaire").query({ q: m.nom }).set(...bearer(lecteur.token));
    expect(annuaire.body).toHaveLength(0);
    expect((await request(app).get(`/api/membres/${m.id}/evenements`).set(...bearer(sg))).body[0]).toMatchObject({ type: "RADIATION", statutApres: "RADIE", reference: "CD-2026-R2" });
  });
});

describe("Parcours 6 — droits : bâtonnier et secrétaire général sur la validation", () => {
  it("le SG saisit et instruit ; le bâtonnier enregistre les décisions (stage, discipline, omission)", async () => {
    const s = await creerMembre("Droits Stagiaire", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    expect((await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(sg))).status).toBe(403);
    expect((await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(tr))).status).toBe(403);
    expect((await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat))).status).toBe(200);

    const m = await creerMembre("Droits Discipline");
    const d = await ouvrirDossier(m.id); // saisine par le SG : 201
    expect((await decider(d.id, sg, { sanctionCode: "AVERTISSEMENT" })).status).toBe(403);
    expect((await decider(d.id, tr, { sanctionCode: "AVERTISSEMENT" })).status).toBe(403);
    expect((await request(app).patch(`/api/discipline/${d.id}`).set(...bearer(sg)).send({ statut: "DECISION" })).status).toBe(403);
    expect((await decider(d.id, bat, { sanctionCode: "AVERTISSEMENT" })).status).toBe(200);

    const omission = { type: "OMISSION", annee: 2026, reference: "CNO-X" };
    expect((await request(app).post(`/api/membres/${m.id}/evenements`).set(...bearer(sg)).send(omission)).status).toBe(403);
    // La matrice expose les actions par rôle (paramétrable en Paramètres).
    const rbac = await request(app).get("/api/rbac").set(...bearer(admin));
    expect(rbac.status).toBe(200);
    expect(JSON.stringify(rbac.body)).toContain("discipline_decider");
  });
});

describe("Parcours 7 — tableau : mise à jour en temps réel et export PDF", () => {
  it("un changement de situation diffuse le signal « tableau » et se lit aussitôt dans le tableau daté", async () => {
    const s = await creerMembre("Temps Reel", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });
    const avant = signaux.length;
    expect((await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(bat))).status).toBe(200);
    expect(signaux.slice(avant)).toContainEqual({ type: "tableau" });
    const t = await tableau();
    expect(section(t, "AVOCAT").some((m) => m.id === s.id)).toBe(true);
    const maj = (await prisma.membre.findUniqueOrThrow({ where: { id: s.id } })).updatedAt;
    expect(new Date(t.miseAJour).getTime()).toBeGreaterThanOrEqual(maj.getTime());
  });

  // PDF du tableau complet (plusieurs milliers de lignes en base de test) : délai propre.
  it.skipIf(!aPdf)("GET /tableau/pdf : PDF daté « Mis à jour le », qui contient l'avocat ajouté", async () => {
    await creerMembre("Tableau PDF");
    const r = await request(app).get("/api/tableau/pdf").set(...bearer(sg)).buffer(true).parse(binaire);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("application/pdf");
    const texte = textePdf(r.body as Buffer);
    expect(texte).toMatch(/mis à jour le \d/i);
    // Colonne étroite : la fin du nom (horodatage) passe à la ligne ; le début suffit à l'identifier.
    expect(texte).toContain(`Me ${PREFIXE} Tableau PDF`);
  }, 180_000);
});

describe("Parcours 8 — messagerie : recherche, Contacter, pièce, accusé imprimable, attestation archivée", () => {
  it("de la recherche d'un confrère jusqu'à l'attestation délivrée et archivée", async () => {
    const a = await avocatEspace("Expediteur");
    const b = await avocatEspace("Destinataire");
    // Recherche d'un confrère dans l'annuaire, puis « Contacter » avec une pièce jointe.
    const trouve = await request(app).get("/api/espace/annuaire").query({ q: b.nom }).set(...bearer(a.token));
    expect(trouve.body.map((x: { id: number }) => x.id)).toEqual([b.id]);
    const SECRET = `Conclusions confidentielles ${marque}`;
    const fil = await request(app).post("/api/espace/messagerie").set(...bearer(a.token))
      .send({ sujet: `${PREFIXE} conclusions`, corps: SECRET, destinataireMembreId: b.id, piece: { nomFichier: "conclusions.pdf", donnees: b64(PDF) } });
    expect(fil.status).toBe(201);
    // Le destinataire reçoit (liste) puis lit (ouverture) ; il télécharge la pièce.
    await request(app).get("/api/espace/messagerie").set(...bearer(b.token));
    const lu = await request(app).get(`/api/espace/messagerie/${fil.body.id}`).set(...bearer(b.token));
    const msg = lu.body.messages[0];
    expect(msg).toMatchObject({ corps: SECRET, piece: expect.objectContaining({ nom: "conclusions.pdf", mime: "application/pdf" }) });
    expect(msg.recuAt).toBeTruthy();
    expect(msg.luAt).toBeTruthy();
    expect(msg.empreinte).toMatch(/^[0-9a-f]{64}$/);
    const dl = await request(app).get(`/api/espace/messagerie/messages/${msg.id}/piece`).set(...bearer(b.token)).buffer(true).parse(binaire);
    expect(Buffer.from(dl.body as Buffer).equals(PDF)).toBe(true);

    // Accusé de lecture imprimable, horodaté, sans le corps du message.
    if (aPdf) {
      const acc = await request(app).get(`/api/espace/messagerie/messages/${msg.id}/accuse/pdf`).set(...bearer(a.token)).buffer(true).parse(binaire);
      expect(acc.status).toBe(200);
      const texte = textePdf(acc.body as Buffer);
      expect(texte).toContain(msg.empreinte);
      expect(texte).toContain("Première ouverture");
      expect(texte).toContain("Valeur probatoire à confirmer");
      expect(texte).not.toContain(SECRET);
    }

    // « Contacter » depuis la fiche, côté administration.
    expect((await request(app).post("/api/messagerie").set(...bearer(sg)).send({ membreId: a.id, sujet: `${PREFIXE} contact`, corps: "Merci de passer au secrétariat." })).status).toBe(201);

    // Demande d'attestation, délivrance par l'administration, archivage.
    const demande = await request(app).post("/api/espace/attestations/demandes").set(...bearer(a.token)).send({ type: "INSCRIPTION" });
    expect(demande.status).toBe(201);
    if (!trouverChromium()) return;
    const deliv = await request(app).post(`/api/messagerie/${demande.body.id}/attestation`).set(...bearer(sg));
    expect(deliv.status, JSON.stringify(deliv.body)).toBe(201);
    expect(await prisma.archive.findFirst({ where: { reference: deliv.body.numero } })).toMatchObject({ categorie: "Attestation d'inscription" });
    const conv = (await request(app).get(`/api/espace/messagerie/${demande.body.id}`).set(...bearer(a.token))).body;
    expect(conv.messages.some((x: { piece?: { nom: string } }) => x.piece?.nom === `Attestation-${deliv.body.numero}.pdf`)).toBe(true);
  }, 120_000);
});

describe("Parcours 9 — dépôt d'une pièce : rejet motivé, notification, nouvelle soumission, validation", () => {
  it("l'avocat est notifié du rejet et des corrections demandées, redépose, puis la pièce est validée", async () => {
    const av = await avocatEspace("Pieces");
    const deposer = () => request(app).post("/api/espace/pieces").set(...bearer(av.token)).send({ type: "DIPLOME", nomFichier: "diplome.pdf", mimeType: "application/pdf", donnees: b64(PDF) });
    const p1 = await deposer();
    expect(p1.status).toBe(201);
    const file = await request(app).get("/api/pieces").query({ statut: "A_VERIFIER" }).set(...bearer(sg));
    expect(file.body.some((p: { id: number }) => p.id === p1.body.id)).toBe(true);

    expect((await request(app).post(`/api/pieces/${p1.body.id}/rejeter`).set(...bearer(sg)).send({})).status).toBe(400); // motif obligatoire
    expect((await request(app).post(`/api/pieces/${p1.body.id}/rejeter`).set(...bearer(sg)).send({ note: "Copie illisible : merci de déposer une copie certifiée." })).status).toBe(200);
    const notifs = async () => (await request(app).get("/api/espace/notifications").set(...bearer(av.token))).body.items as { type: string; message: string }[];
    await expect.poll(async () => (await notifs()).find((n) => n.type === "PIECE_REJETEE")?.message ?? "").toContain("copie certifiée");
    const mesPieces = async () => (await request(app).get("/api/espace/pieces").set(...bearer(av.token))).body as { id: number; statut: string; note: string | null }[];
    expect((await mesPieces()).find((p) => p.id === p1.body.id)).toMatchObject({ statut: "REJETEE", note: expect.stringContaining("copie certifiée") });

    const p2 = await deposer();
    expect(p2.status).toBe(201);
    expect((await request(app).post(`/api/pieces/${p2.body.id}/verifier`).set(...bearer(sg))).status).toBe(200);
    await expect.poll(async () => (await notifs()).some((n) => n.type === "PIECE_VERIFIEE")).toBe(true);
    expect((await mesPieces()).find((p) => p.id === p2.body.id)?.statut).toBe("VERIFIEE");
  });
});

describe("Parcours 10 — corps électoral à une date donnée (cotisations + discipline) et éligibilité", () => {
  it("deux dates encadrant un paiement et une interdiction donnent deux listes ; ancienneté et peine accessoire contrôlées", async () => {
    const montant = cotisationDue(null, await tarifsActuels(), "AVOCAT");
    const payer = async (membreId: number, date: string) => {
      expect((await request(app).post("/api/cotisations/paiement").set(...bearer(tr)).send({ membreId, annee: 2026, montant, mode: "Espèces", date })).status).toBe(201);
      // R2-8 : versement réellement reçu à cette date (horodatage serveur simulé).
      await prisma.recu.updateMany({ where: { membreId, annee: 2026 }, data: { createdAt: new Date(`${date}T12:00:00Z`) } });
    };
    const a = await creerMembre("Electeur Paiement", { dateInscription: "2015-01-10" });
    await payer(a.id, "2026-05-10");
    const b = await creerMembre("Electeur Interdit", { dateInscription: "2015-01-10" });
    await payer(b.id, "2026-01-15");
    const db = await ouvrirDossier(b.id);
    expect((await decider(db.id, bat, { sanctionCode: "INTERDICTION_TEMPORAIRE", dureeMois: 3, dateDecision: "2026-06-01" })).status).toBe(200);
    const st = await creerMembre("Electeur Stagiaire", { qualite: "STAGIAIRE", statut: "STAGIAIRE" });

    const corps = async (date: string) => {
      const r = await request(app).get("/api/corps-electoral").query({ date }).set(...bearer(sg));
      expect(r.status).toBe(200);
      return new Set((r.body.electeurs as { id: number }[]).map((x) => x.id));
    };
    const avril = await corps("2026-04-30");
    const juillet = await corps("2026-07-15");
    expect([avril.has(a.id), juillet.has(a.id)]).toEqual([false, true]); // cotisation payée entre les deux dates
    expect([avril.has(b.id), juillet.has(b.id)]).toEqual([true, false]); // interdiction ferme entre les deux dates
    expect(juillet.has(st.id)).toBe(false);

    // Éligibilité au bâtonnat : plus de 8 ans d'inscription (comparaison stricte), peine accessoire.
    const s = await request(app).post("/api/scrutins").set(...bearer(sg)).send({ titre: `${PREFIXE} Bâtonnat ${marque}`, type: "BATONNIER", modalite: "PRESENTIEL", nbSieges: 1, dateScrutin: "2026-12-15" });
    expect(s.status).toBe(201);
    scrutins.push(s.body.id);
    const candidater = (membreId: number, nom: string) => request(app).post(`/api/scrutins/${s.body.id}/candidats`).set(...bearer(sg)).send({ nom, membreId });
    const huitAns = await creerMembre("Huit Ans", { dateInscription: "2018-12-15" });
    const refus = await candidater(huitAns.id, huitAns.nom);
    expect(refus.status).toBe(409);
    expect(JSON.stringify(refus.body)).toMatch(/ancienneté/i);
    const g = await creerMembre("Peine Accessoire", { dateInscription: "2010-01-10" });
    const dg = await ouvrirDossier(g.id);
    expect((await decider(dg.id, bat, { sanctionCode: "AVERTISSEMENT", peineAccessoireMois: 24, dateDecision: "2026-01-10" })).status).toBe(200);
    const peine = await candidater(g.id, g.nom);
    expect(peine.status).toBe(409);
    expect(JSON.stringify(peine.body)).toMatch(/peine accessoire/i);
    expect((await candidater(a.id, a.nom)).status).toBe(201);
  }, 60_000);
});

describe("Parcours 11 — reçu personnalisé à l'identité d'un barreau", () => {
  it("après changement de l'identité en Paramètres, le reçu porte la nouvelle dénomination, la ville et le logo", async () => {
    const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const actuelle = (await request(app).get("/api/parametres").set(...bearer(sg))).body.identite;
    const put = await request(app).put("/api/parametres").set(...bearer(sg))
      .send({ identite: { ...actuelle, denomination: "Barreau de démonstration", ville: "Brazzaville", logo: LOGO, modeDemonstration: true, adresse: "Adresse de démonstration", courriel: "contact@demo.test", site: "www.demo.test", telephones: "+242 00 000 00 00" } });
    expect(put.status).toBe(200);

    const m = await creerMembre("Recu Personnalise");
    const paie = await request(app).post("/api/cotisations/paiement").set(...bearer(tr)).send({ membreId: m.id, annee: 2026, montant: 50000, mode: "Espèces" });
    expect(paie.status).toBe(201);
    const recu = await prisma.recu.findUniqueOrThrow({ where: { numero: paie.body.recu.numero }, include: { membre: true } });
    const html = recuRicheHtml(recu, recu.membre, "data:,", "http://x"); // gabarit de GET /recus/:id/pdf
    expect(html).toContain(LOGO);
    expect(html.toLowerCase()).not.toContain("pointe-noire");
    if (!aPdf) return;
    const r = await request(app).get(`/api/recus/${recu.id}/pdf`).set(...bearer(tr)).buffer(true).parse(binaire);
    expect(r.status).toBe(200);
    const texte = textePdf(r.body as Buffer);
    expect(texte).toContain("Brazzaville, le");
    expect(texte.toUpperCase()).toContain("BARREAU DE DÉMONSTRATION");
    expect(texte).toContain(recu.numero);
    expect(texte.toLowerCase()).not.toContain("pointe-noire");
  }, 60_000);
});

describe("Parcours 12 — journal d'audit : opération tracée, conversations privées inaccessibles", () => {
  it("l'envoi et la modification sont tracés et filtrables ; ni le contenu, ni le fil privé ne sont accessibles ; journal immuable", async () => {
    const depuis = await maxAudit();
    const a = await avocatEspace("Audit A");
    const b = await avocatEspace("Audit B");
    const SECRET = `SECRET-PARCOURS12-${marque}`;
    const fil = await request(app).post("/api/espace/messagerie").set(...bearer(a.token)).send({ sujet: `Sujet ${SECRET}`, corps: `Corps ${SECRET}`, destinataireMembreId: b.id });
    expect(fil.status).toBe(201);
    expect((await request(app).patch(`/api/membres/${b.id}`).set(...bearer(sg)).send({ cabinet: "Cabinet Audit" })).status).toBe(200);

    const envoi = await ligneAudit({ chemin: "/api/espace/messagerie", methode: "POST" }, depuis);
    expect(envoi?.action).toMatch(/^Envoi d'un message — Messagerie \(message #\d+\)$/);
    const modif = await ligneAudit({ userId: sgId, chemin: `/api/membres/${b.id}` }, depuis);
    expect(modif).not.toBeNull();
    const filtre = await request(app).get("/api/audit").query({ userId: String(sgId), from: jour(new Date()), pageSize: 100 }).set(...bearer(sg));
    expect(filtre.status).toBe(200);
    expect(filtre.body.items.some((i: { id: number }) => i.id === modif!.id)).toBe(true);
    expect(filtre.body.items.every((i: { userId: number }) => i.userId === sgId)).toBe(true);

    // Contenu privé : absent du journal (toutes colonnes, et réponse de l'API) ; fil inaccessible à l'administration.
    const colonnes = ["action", "cible", "methode", "chemin", "ip", "userNom"] as const;
    expect(await prisma.journalAudit.count({ where: { OR: colonnes.map((c) => ({ [c]: { contains: SECRET } })) } })).toBe(0);
    expect(JSON.stringify((await request(app).get("/api/audit").query({ pageSize: 200 }).set(...bearer(admin))).body)).not.toContain(SECRET);
    expect((await request(app).get(`/api/messagerie/${fil.body.id}`).set(...bearer(sg))).status).toBe(404);
    expect((await request(app).get("/api/messagerie").set(...bearer(sg))).body.map((c: { id: number }) => c.id)).not.toContain(fil.body.id);
    expect((await request(app).get(`/api/messagerie/${fil.body.id}`).set(...bearer(admin))).status).toBe(403); // secret professionnel

    // Non modifiable : aucune route d'écriture, et la base refuse UPDATE / DELETE (trigger).
    expect((await request(app).delete(`/api/audit/${envoi!.id}`).set(...bearer(admin))).status).toBe(404);
    await expect(prisma.journalAudit.update({ where: { id: envoi!.id }, data: { action: "falsifié" } })).rejects.toThrow();
    await expect(prisma.journalAudit.delete({ where: { id: envoi!.id } })).rejects.toThrow();
    expect((await prisma.journalAudit.findUniqueOrThrow({ where: { id: envoi!.id } })).action).toBe(envoi!.action);
  }, 60_000);
});
