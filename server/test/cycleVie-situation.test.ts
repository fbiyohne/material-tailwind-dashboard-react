import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { creerApp } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { changerSituation, situationADate } from "../src/lib/cycleVie.js";
import { estRecuDroit, STATUTS_ANNUAIRE, STATUTS_SORTIS, eligibiliteElectorale } from "../src/lib/business.js";

/**
 * T5 — cycle de vie : situation d'un membre à une date (fonction pure, D10) et
 * changement de situation transactionnel avec événement d'historique (D5).
 */
const D = new Date("2026-06-30T23:59:59Z");
const j = (iso: string) => new Date(`${iso}T12:00:00Z`);
const membre = (extra: Record<string, unknown> = {}) => ({
  statut: "INSCRIT" as const,
  dateInscription: j("2010-01-15"),
  cotisations: [] as { annee: number; montantDu: number; montantPaye: number; datePaiement: Date | null }[],
  ...extra,
});
const evt = (dateEffet: string, statutAvant: string, statutApres: string) =>
  ({ dateEffet: j(dateEffet), statutAvant, statutApres }) as never;

describe("situationADate (D10, fonction pure)", () => {
  it("retient le statut du dernier événement antérieur ou égal à D", () => {
    const s = situationADate(membre({ statut: "RADIE" }), [evt("2026-02-01", "INSCRIT", "OMIS"), evt("2026-04-01", "OMIS", "INSCRIT"), evt("2026-09-01", "INSCRIT", "RADIE")], [], [], D);
    expect(s.statut).toBe("INSCRIT");
  });

  it("sans événement antérieur, reprend le statut d'avant le premier événement postérieur", () => {
    expect(situationADate(membre({ statut: "RADIE" }), [evt("2026-09-01", "INSCRIT", "RADIE")], [], [], D).statut).toBe("INSCRIT");
  });

  it("sans aucun événement, retient le statut courant (limite PO-20)", () => {
    expect(situationADate(membre({ statut: "OMIS" }), [], [], [], D).statut).toBe("OMIS");
  });

  it("exclut un membre inscrit après D (statut null)", () => {
    expect(situationADate(membre({ dateInscription: j("2026-07-01") }), [], [], [], D).statut).toBeNull();
  });

  it("compte comme SUSPENDU une interdiction ferme qui couvre D", () => {
    const dossier = { sursis: false, sanctionDebut: j("2026-05-01"), sanctionFin: j("2026-08-01"), peineAccessoireMois: null, dateDecision: j("2026-04-20") };
    expect(situationADate(membre(), [], [dossier], [], D).statut).toBe("SUSPENDU");
    // La même interdiction, échue avant D ou commencée après, ne suspend pas.
    expect(situationADate(membre(), [], [{ ...dossier, sanctionFin: j("2026-06-01") }], [], D).statut).toBe("INSCRIT");
    expect(situationADate(membre(), [], [{ ...dossier, sanctionDebut: j("2026-07-01") }], [], D).statut).toBe("INSCRIT");
  });

  it("une interdiction avec sursis laisse l'avocat inscrit, avec la mention de sursis", () => {
    const dossier = { sursis: true, sanctionDebut: j("2026-05-01"), sanctionFin: j("2026-08-01"), peineAccessoireMois: null, dateDecision: j("2026-04-20") };
    const s = situationADate(membre(), [], [dossier], [], D);
    expect(s.statut).toBe("INSCRIT");
    expect(s.sursis).toBe(true);
  });

  it("une peine accessoire en cours à D rend inéligible, pas au-delà de sa durée", () => {
    const dossier = { sursis: false, sanctionDebut: null, sanctionFin: null, peineAccessoireMois: 12, dateDecision: j("2025-09-01") };
    expect(situationADate(membre(), [], [dossier], [], D).ineligible).toBe(true);
    expect(situationADate(membre(), [], [{ ...dossier, peineAccessoireMois: 6 }], [], D).ineligible).toBe(false);
    expect(situationADate(membre(), [], [], [], D).ineligible).toBe(false);
  });

  it("cotisation : seuls les reçus de cotisation de l'exercice datés au plus tard de D comptent", () => {
    const m = membre({ cotisations: [{ annee: 2026, montantDu: 150000, montantPaye: 150000, datePaiement: j("2026-08-10") }] });
    const recus = [
      { annee: 2026, montant: 100000, date: j("2026-03-01"), objet: "Cotisation ordinale 2026" },
      { annee: 2026, montant: 50000, date: j("2026-08-10"), objet: "Cotisation ordinale 2026" }, // après D
      { annee: 2026, montant: 60000, date: j("2026-02-01"), objet: "Droit de plaidoirie 2026" }, // pas une cotisation
      { annee: 2025, montant: 150000, date: j("2025-03-01"), objet: "Cotisation ordinale 2025" }, // autre exercice
    ];
    const s = situationADate(m, [], [], recus, D);
    expect(s.annee).toBe(2026);
    expect(s.cotisation).toEqual({ montantDu: 150000, montantPaye: 100000 });
    // Payée avant D : à jour.
    const avant = situationADate(m, [], [], [{ annee: 2026, montant: 150000, date: j("2026-03-01"), objet: "Cotisation ordinale 2026" }], D);
    expect(eligibiliteElectorale({ qualite: "AVOCAT", statut: avant.statut! }, avant.cotisation)).toEqual({ eligible: true, raison: null });
    expect(eligibiliteElectorale({ qualite: "AVOCAT", statut: s.statut! }, s.cotisation).raison).toBe("cotisation");
  });

  it("cotisation sans reçu : la ligne compte si datePaiement est au plus tard D", () => {
    const ligne = { annee: 2026, montantDu: 150000, montantPaye: 150000, datePaiement: j("2026-03-01") };
    expect(situationADate(membre({ cotisations: [ligne] }), [], [], [], D).cotisation).toEqual({ montantDu: 150000, montantPaye: 150000 });
    expect(situationADate(membre({ cotisations: [{ ...ligne, datePaiement: j("2026-07-01") }] }), [], [], [], D).cotisation).toEqual({ montantDu: 150000, montantPaye: 0 });
    expect(situationADate(membre(), [], [], [], D).cotisation).toBeNull();
  });
});

describe("Constantes de statut (D8, D11) et règle des reçus (recus.ts)", () => {
  it("les sorties volontaires sont hors tableau ; l'annuaire ne montre qu'inscrits, stagiaires, honoraires", () => {
    expect(STATUTS_SORTIS).toEqual(["RADIE", "DECEDE", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"]);
    expect(STATUTS_ANNUAIRE).toEqual(["INSCRIT", "STAGIAIRE", "HONORAIRE"]);
    for (const statut of ["DEMISSIONNAIRE", "RETRAITE", "CESSATION"])
      expect(eligibiliteElectorale({ qualite: "AVOCAT", statut }, { montantDu: 1, montantPaye: 1 })).toEqual({ eligible: false, raison: "statut" });
  });

  it("estRecuDroit distingue droit de plaidoirie et cotisation", () => {
    expect(estRecuDroit("Droit de plaidoirie 2026")).toBe(true);
    expect(estRecuDroit("Cotisation ordinale 2026")).toBe(false);
    expect(estRecuDroit(null)).toBe(false);
  });
});

describe("changerSituation et tableau (base de test)", () => {
  const app = creerApp();
  const bearer = (t: string) => ["Authorization", `Bearer ${t}`] as const;
  const base = 960000 + (Date.now() % 1000) * 5;
  const ids: number[] = [];
  let sg = "";

  beforeAll(async () => {
    sg = (await request(app).post("/api/auth/login").send({ email: "sg@barreau-pn.cg", password: "barreau" })).body.token;
    for (const [i, statut] of (["INSCRIT", "DEMISSIONNAIRE", "RETRAITE", "CESSATION"] as const).entries()) {
      const m = await prisma.membre.create({ data: { num: base + i, numInscription: `T5-${base + i}`, nom: `T5 ${statut}`, qualite: "AVOCAT", statut, dateInscription: new Date("2015-01-01") } });
      ids.push(m.id);
    }
  });

  afterAll(async () => {
    await prisma.membre.deleteMany({ where: { id: { in: ids } } });
  });

  it("crée exactement un EvenementSituation avec statut avant/après, acteur et motif", async () => {
    const { membre: m, evenement } = await changerSituation({
      membreId: ids[0], type: "RADIATION", demande: { statut: "RADIE", dateRadiation: new Date("2026-05-02"), motifRadiation: "Décision n° 12" },
      dateEffet: new Date("2026-05-02"), motif: "Décision du conseil de discipline", reference: "DEC-12", acteur: { id: null, nom: "Test T5" },
    });
    expect(m.statut).toBe("RADIE");
    expect(m.dateRadiation?.toISOString().slice(0, 10)).toBe("2026-05-02");
    const evts = await prisma.evenementSituation.findMany({ where: { membreId: ids[0] } });
    expect(evts).toHaveLength(1);
    expect(evts[0]).toMatchObject({ id: evenement.id, type: "RADIATION", statutAvant: "INSCRIT", statutApres: "RADIE", reference: "DEC-12", acteurNom: "Test T5" });
  });

  it("annule tout (membre et événement) si une écriture échoue", async () => {
    // Retour à INSCRIT, avec une pièce inexistante : la clé étrangère fait échouer l'événement.
    await expect(changerSituation({ membreId: ids[0], type: "REINSCRIPTION", demande: { statut: "INSCRIT" }, pieceId: 2_000_000_000 })).rejects.toThrow();
    expect((await prisma.membre.findUnique({ where: { id: ids[0] } }))?.statut).toBe("RADIE");
    expect(await prisma.evenementSituation.count({ where: { membreId: ids[0] } })).toBe(1);
  });

  it("refuse une transition invalide sans rien écrire (machine à états)", async () => {
    await prisma.membre.update({ where: { id: ids[0] }, data: { statut: "DECEDE", dateDeces: new Date("2026-06-01"), dateRadiation: null, motifRadiation: null } });
    await expect(changerSituation({ membreId: ids[0], type: "RADIATION", demande: { statut: "RADIE", dateRadiation: new Date() } })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.evenementSituation.count({ where: { membreId: ids[0] } })).toBe(1);
  });

  it("les membres démissionnaires, retraités ou en cessation sont absents du tableau", async () => {
    const r = await request(app).get("/api/tableau").set(...bearer(sg));
    expect(r.status).toBe(200);
    const presents = new Set(r.body.sections.flatMap((s: { membres: { id: number }[] }) => s.membres.map((x) => x.id)));
    for (const id of ids.slice(1)) expect(presents.has(id)).toBe(false);
  });

  it("valider-stage refuse un stagiaire démissionnaire (409, rien modifié) : contrôle sur STATUTS_SORTIS", async () => {
    const admin = (await request(app).post("/api/auth/login").send({ email: "admin@barreau-pn.cg", password: "barreau" })).body.token;
    const s = await prisma.membre.create({ data: { num: base + 4, numInscription: `T5-${base + 4}`, nom: "T5 STAGIAIRE DEMISSIONNAIRE", qualite: "STAGIAIRE", statut: "DEMISSIONNAIRE" } });
    ids.push(s.id);
    const r = await request(app).post(`/api/membres/${s.id}/valider-stage`).set(...bearer(admin));
    expect(r.status).toBe(409);
    expect(await prisma.membre.findUnique({ where: { id: s.id } })).toMatchObject({ qualite: "STAGIAIRE", statut: "DEMISSIONNAIRE", stageValideAt: null });
  });
});
