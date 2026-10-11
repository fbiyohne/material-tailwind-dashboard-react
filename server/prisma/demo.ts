/**
 * Jeu de démonstration du congrès (T25, CA15) — 100 % FICTIF, idempotent.
 *
 *   npm run demo                                   # données seules
 *   npm run demo -- --identite=demonstration       # + identité « Barreau de démonstration »
 *   npm run demo -- --identite=pointe-noire        # retour à l'identité de base
 *
 * Garde-fou : le script lit DATABASE_URL et REFUSE toute base dont le nom n'est pas
 * exactement `barreau_pn_test`, avant d'ouvrir la moindre connexion (code de sortie 1).
 * Le DATABASE_URL du .env vise barreau_pn : il faut donc désigner la base de test
 * explicitement, par exemple `DATABASE_URL="$TEST_DATABASE_URL" npm run demo`
 * (dotenv ne remplace pas une variable déjà définie).
 *
 * Idempotence : clés naturelles (num 800001 à 800200, numInscription « DEMO-… »,
 * dossiers « DEMO-AAAA-NN », sujets « [DEMO] … », références « DEMO-… »). Les autres
 * membres de la base ne sont jamais lus ni modifiés. Aucun e-mail n'est envoyé :
 * l'adresse du membre est retirée de l'objet transmis à l'encaissement.
 * Brazzaville n'est volontairement pas activable : aucune identité de barreau réel
 * sans accord écrit de ce barreau (PO-22).
 */
import "dotenv/config";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE_AUTORISEE = "barreau_pn_test";
const IDENTITES = ["demonstration", "pointe-noire"] as const;

function echec(message: string): never {
  console.error(`demo : ${message}`);
  process.exit(1);
}

// ─── Garde-fous (avant tout import qui ouvrirait une connexion) ──────────────
const args = process.argv.slice(2);
const identiteVoulue = args.find((a) => a.startsWith("--identite="))?.slice("--identite=".length);
if (identiteVoulue !== undefined && !(IDENTITES as readonly string[]).includes(identiteVoulue))
  echec(`identité « ${identiteVoulue} » inconnue (valeurs : ${IDENTITES.join(", ")}). Brazzaville n'est pas activable sans l'accord écrit de ce barreau.`);
let nomBase = "";
try {
  nomBase = new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
} catch {
  echec("DATABASE_URL absent ou illisible.");
}
if (nomBase !== BASE_AUTORISEE) echec(`la base « ${nomBase} » est refusée : seule ${BASE_AUTORISEE} est autorisée. Aucune écriture effectuée.`);

const { prisma } = await import("../src/prisma.js");
const { encaisser } = await import("../src/lib/encaissement.js");
const { changerSituation } = await import("../src/lib/cycleVie.js");
const { empreinteMessage } = await import("../src/lib/messagerie.js");
const { montantDuAvec, tarifsActuels, prochainNumeroTimbre } = await import("../src/lib/business.js");
const bcrypt = (await import("bcryptjs")).default;

// ─── Données fictives ────────────────────────────────────────────────────────
// Noms fabriqués par assemblage de syllabes : aucun nom d'avocat réel n'est visé.
const D1 = ["BAL", "KEM", "TOR", "VAN", "MIR", "SOL", "DEK", "FAL", "NUR", "PIL"];
const D2 = ["ANDRE", "IVOR", "ONDE", "ARDI", "ELIS", "UMBA", "ORIN", "ETTE", "AGNO", "OLIK"];
const PRENOMS = ["Aline", "Rodrigue", "Estelle", "Fabrice", "Nadège", "Gaël", "Prisca", "Hervé", "Sylvie", "Cédric",
  "Mireille", "Thierry", "Laure", "Yannick", "Chantal", "Bruno", "Odile", "Régis", "Flore", "Damien"];
const nomDe = (k: number) => `${D1[k % 10]}${D2[Math.floor(k / 10) % 10]} ${PRENOMS[(k * 7) % 20]}`;
const nomCabinet = (c: number) => `Cabinet ${D1[c % 10]}${D2[(c * 3) % 10]} & Associés (DEMO)`;
const NUM0 = 800001;
const MODES = ["Espèces", "Virement", "MTN Mobile Money", "Airtel Money"];
const jour = (a: number, m: number, j: number) => new Date(Date.UTC(a, m - 1, j, 9));

type Spec = { k: number; qualite: "AVOCAT" | "STAGIAIRE" | "HONORAIRE"; role?: string };
// 60 avocats courants, 15 stagiaires, puis les cas de la démonstration.
const SPECS: Spec[] = [
  ...Array.from({ length: 60 }, (_, k) => ({ k, qualite: "AVOCAT" as const })),
  ...Array.from({ length: 15 }, (_, i) => ({ k: 60 + i, qualite: "STAGIAIRE" as const })),
  { k: 75, qualite: "AVOCAT", role: "classement" },
  { k: 76, qualite: "AVOCAT", role: "avertissement" },
  { k: 77, qualite: "AVOCAT", role: "sursis" },
  { k: 78, qualite: "AVOCAT", role: "radiation" },
  { k: 79, qualite: "AVOCAT", role: "omission" },
  { k: 80, qualite: "HONORAIRE" },
];

async function main() {
  const num = (k: number) => NUM0 + k;

  // Cabinets (10) : clé naturelle = nom suffixé « (DEMO) ».
  const cabinets: { id: number }[] = [];
  for (let c = 0; c < 10; c++) {
    const nom = nomCabinet(c);
    const ex = await prisma.cabinet.findFirst({ where: { nom } });
    cabinets.push(ex ?? (await prisma.cabinet.create({
      data: { nom, forme: c % 3 === 0 ? "Société civile professionnelle" : c % 3 === 1 ? "Association d'avocats" : "Cabinet individuel", adresse: "Adresse fictive", conventionDeposee: c % 2 === 0 },
    })));
  }

  // Membres : upsert sur num ; update vide, donc une fiche déjà créée n'est jamais réécrite.
  const ids = new Map<number, number>();
  for (const s of SPECS) {
    const cab = s.k < 50 ? cabinets[s.k % 10] : null;
    const stagiaire = s.qualite === "STAGIAIRE";
    const m = await prisma.membre.upsert({
      where: { num: num(s.k) },
      update: {},
      create: {
        num: num(s.k),
        numInscription: `DEMO-${String(s.k + 1).padStart(4, "0")}`,
        nom: nomDe(s.k),
        qualite: s.qualite,
        statut: stagiaire ? "STAGIAIRE" : s.qualite === "HONORAIRE" ? "HONORAIRE" : "INSCRIT",
        sexe: s.k % 2 ? "F" : "H",
        cabinet: cab ? nomCabinet(s.k) : null,
        cabinetId: cab?.id ?? null,
        tel: `+242 00 000 ${String(s.k).padStart(4, "0")}`,
        email: `demo.${num(s.k)}@demo.invalid`,
        dateInscription: stagiaire ? null : jour(2008 + (s.k % 16), 1 + (s.k % 12), 1 + (s.k % 27)),
        dateServment: stagiaire ? jour(2025 - (s.k % 2), 1 + (s.k % 12), 10) : null,
        dureeMois: stagiaire ? 24 : null,
        maitreStage: stagiaire ? nomDe(s.k - 60) : null,
        observations: "Données fictives de démonstration.",
      },
    });
    ids.set(s.k, m.id);
  }
  for (let c = 0; c < 10; c++) {
    await prisma.cabinet.updateMany({ where: { id: cabinets[c].id, titulaireId: null }, data: { titulaireId: ids.get(c)! } });
  }

  // Cotisations : encaissées par encaisser() (reçus, archives, numérotation cohérents).
  const parametres = await prisma.parametres.findUnique({ where: { id: 1 } });
  const exercice = (parametres?.data as { exerciceCourant?: number } | null)?.exerciceCourant ?? 2026;
  const tarifs = await tarifsActuels();
  for (const s of SPECS) {
    if (s.qualite === "HONORAIRE" || s.role === "radiation") continue;
    const membre = await prisma.membre.findUniqueOrThrow({ where: { id: ids.get(s.k)! } });
    const du = montantDuAvec(tarifs, membre.qualite);
    const profil = s.role === "omission" ? "retard" : s.k % 10 <= 1 ? "retard" : s.k % 10 === 2 && !s.role ? "partiel" : "ajour";
    const annees = s.role === "omission" ? [exercice - 1, exercice] : [exercice];
    for (const annee of annees) {
      const ligne = await prisma.cotisation.upsert({
        where: { membreId_annee: { membreId: membre.id, annee } },
        update: {}, create: { membreId: membre.id, annee, montantDu: du },
      });
      if (ligne.montantPaye > 0 || profil === "retard") continue;
      await encaisser({
        membre: { ...membre, email: null }, // aucun e-mail émis
        annee, type: "cotisation", montant: profil === "partiel" ? Math.floor(du / 2) : du,
        mode: MODES[s.k % 4], ref: `DEMO-PAY-${num(s.k)}`, date: jour(annee, 2 + (s.k % 8), 1 + (s.k % 27)),
      });
    }
  }

  // Dossiers disciplinaires (4). Les décisions suivent POST /discipline/:id/decision.
  const acteur = { id: null, nom: "Bâtonnier (démonstration)" };
  const organe = "Conseil du barreau siégeant en conseil de discipline (art. 36, loi n° 026-92)";
  const dossiers = [
    { ref: "DEMO-2026-01", k: 75, objet: "Retard dans la restitution d'une provision (fictif)", sanctionCode: null as string | null },
    { ref: "DEMO-2026-02", k: 76, objet: "Manquement à l'obligation de diligence (fictif)", sanctionCode: "AVERTISSEMENT" },
    { ref: "DEMO-2026-03", k: 77, objet: "Publicité personnelle irrégulière (fictif)", sanctionCode: "INTERDICTION_TEMPORAIRE" },
    { ref: "DEMO-2026-04", k: 78, objet: "Détournement de fonds clients (fictif)", sanctionCode: "RADIATION" },
  ];
  for (const [i, dd] of dossiers.entries()) {
    const membreId = ids.get(dd.k)!;
    const d = await prisma.dossierDisciplinaire.upsert({
      where: { reference: dd.ref },
      update: {},
      create: {
        reference: dd.ref, membreId, avocatNom: nomDe(dd.k), objet: dd.objet, plaignant: "Justiciable fictif",
        origine: "Plainte", rapporteur: "Me DEMO Rapporteur", dateSaisine: jour(2026, 1 + i, 12),
        dateDesignationRapporteur: jour(2026, 2 + i, 1), dateRapport: jour(2026, 3 + i, 1),
        conclusionRapport: "Rapport d'instruction fictif.", orientation: dd.sanctionCode ? "POURSUITE" : "CLASSEMENT",
        juridiction: "Conseil de discipline", dateAudience: dd.sanctionCode ? jour(2026, 4 + i, 8) : null,
        statut: dd.sanctionCode ? "AUDIENCE" : "CLASSE",
        decision: dd.sanctionCode ? null : "Classement sans suite.",
      },
    });
    if (!dd.sanctionCode || d.sanctionCode) continue;
    const dateDecision = jour(2026, 5 + i, 20);
    const sursis = dd.sanctionCode === "INTERDICTION_TEMPORAIRE";
    const duree = sursis ? 6 : null;
    const libelle = ({ AVERTISSEMENT: "Avertissement", INTERDICTION_TEMPORAIRE: "Interdiction temporaire", RADIATION: "Radiation" } as Record<string, string>)[dd.sanctionCode] + (sursis ? " (6 mois, avec sursis)" : "");
    const commun = { membreId, dossierId: d.id, dateEffet: dateDecision, motif: libelle, reference: dd.ref, details: { sanctionCode: dd.sanctionCode, dureeMois: duree, sursis, decidePar: organe }, acteur };
    if (dd.sanctionCode === "RADIATION")
      await changerSituation({ ...commun, type: "RADIATION", demande: { statut: "RADIE", dateRadiation: dateDecision, motifRadiation: `${libelle} — ${dd.ref}` } });
    else await changerSituation({ ...commun, type: "SANCTION" }); // avertissement et sursis : l'avocat reste au tableau
    await prisma.dossierDisciplinaire.update({
      where: { id: d.id },
      data: {
        sanctionCode: dd.sanctionCode, sanctionDureeMois: duree, sursis, motivation: "Motivation fictive de la décision, enregistrée pour la démonstration.",
        decidePar: organe, dateDecision, dateNotification: jour(2026, 5 + i, 25), sanction: libelle, statut: "DECISION",
        decision: `${libelle} — décision enregistrée.`,
      },
    });
  }

  // Omission en cours, au stade de la transmission (délais : 30 j puis 15 j).
  const omis = ids.get(79)!;
  const etapes = [
    { type: "RAPPEL", date: jour(2026, 6, 1), ref: "DEMO-REC-01" },
    { type: "MISE_EN_DEMEURE", date: jour(2026, 7, 6), ref: "DEMO-MED-01" },
    { type: "TRANSMISSION", date: jour(2026, 7, 24), ref: "DEMO-TRA-01" },
  ];
  for (const e of etapes) {
    const annee = exercice - 1;
    if (await prisma.evenementSituation.findFirst({ where: { membreId: omis, type: e.type, annee } })) continue;
    await prisma.evenementSituation.create({
      data: { membreId: omis, type: e.type, dateEffet: e.date, annee, reference: e.ref, motif: `Impayé de l'exercice ${annee}`, statutAvant: "INSCRIT", statutApres: "INSCRIT", acteurNom: "Secrétaire général (démonstration)" },
    });
  }

  // Scrutin test (conseil du barreau), avec date de scrutin et trois candidats.
  const titreScrutin = "[DEMO] Scrutin test — Conseil du barreau";
  if (!(await prisma.scrutin.findFirst({ where: { titre: titreScrutin } }))) {
    await prisma.scrutin.create({
      data: {
        titre: titreScrutin, type: "CONSEIL_BARREAU", modalite: "EN_LIGNE", nbSieges: 2, dateScrutin: jour(2026, 12, 12),
        candidats: { create: [1, 2, 3].map((k) => ({ membreId: ids.get(k)!, nom: nomDe(k) })) },
      },
    });
  }

  // Messagerie : quatre fils, accusés posés ; aucune pièce jointe.
  const fils: { sujet: string; admin: boolean; avec: number[]; attestation: string | null; msgs: { a: "adm" | number; t: string }[] }[] = [
    { sujet: "[DEMO] Convocation à l'assemblée générale", admin: true, avec: [1], attestation: null,
      msgs: [{ a: "adm", t: "Maître, vous êtes convoqué à l'assemblée générale. Merci de confirmer votre présence." }, { a: 1, t: "Bien reçu, je confirme ma présence." }] },
    { sujet: "[DEMO] Question sur ma cotisation", admin: true, avec: [2], attestation: null,
      msgs: [{ a: 2, t: "Mon versement partiel est-il bien enregistré ?" }, { a: "adm", t: "Oui, le solde restant dû figure dans votre espace." }] },
    { sujet: "[DEMO] Substitution d'audience", admin: false, avec: [3, 4], attestation: null,
      msgs: [{ a: 3, t: "Peux-tu me substituer à l'audience de jeudi ?" }, { a: 4, t: "Avec plaisir, envoie-moi le dossier." }] },
    { sujet: "[DEMO] Demande d'attestation d'inscription", admin: true, avec: [5], attestation: "INSCRIPTION",
      msgs: [{ a: 5, t: "Je sollicite une attestation d'inscription." }] },
  ];
  for (const [i, f] of fils.entries()) {
    if (await prisma.conversation.findFirst({ where: { sujet: f.sujet } })) continue;
    const t0 = jour(2026, 9, 1 + i * 2);
    await prisma.conversation.create({
      data: {
        sujet: f.sujet, avecAdministration: f.admin, attestationType: f.attestation, createdAt: t0,
        participants: { create: f.avec.map((k) => ({ membreId: ids.get(k)!, lastReadAt: new Date(t0.getTime() + 3_600_000) })) },
        messages: {
          create: f.msgs.map((m, j) => {
            const horo = new Date(t0.getTime() + (j + 1) * 600_000);
            const adm = m.a === "adm";
            return {
              corps: m.t, empreinte: empreinteMessage(m.t), createdAt: horo, estAdministration: adm,
              auteurMembreId: adm ? null : ids.get(m.a as number)!, auteurNom: adm ? "Secrétariat (démonstration)" : nomDe(m.a as number),
              recuAt: new Date(horo.getTime() + 60_000), luAt: new Date(horo.getTime() + 120_000),
            };
          }),
        },
      },
    });
  }

  // Timbres : 12 internes (émis dans l'application) et 18 externes (import MTN).
  const canaux = ["MTN", "AIRTEL", "SANDBOX"];
  for (let i = 0; i < 12; i++) {
    const code = `DEMOTIMBRE${String(i + 1).padStart(3, "0")}`;
    if (await prisma.timbre.findUnique({ where: { code } })) continue;
    const k = i % 10;
    await prisma.timbre.create({
      data: {
        numero: await prochainNumeroTimbre(), code, membreId: ids.get(k)!, affaire: `Affaire fictive ${i + 1}`, juridiction: "Tribunal de démonstration",
        cabinet: nomCabinet(k), montant: 15000, canal: canaux[i % 3], refPaiement: `DEMO-PAY-T${i + 1}`,
        createdAt: jour(2026, 3 + (i % 7), 3 + i),
      },
    });
  }
  await prisma.timbreExterne.createMany({
    skipDuplicates: true,
    data: Array.from({ length: 18 }, (_, i) => ({
      reference: `DEMO-EXT-${String(i + 1).padStart(3, "0")}`, date: jour(2026, 3 + (i % 7), 2 + i), montant: 15000,
      canal: i % 2 ? "AIRTEL" : "MTN", source: "MTN", avocatNom: nomDe(10 + (i % 20)), importePar: "Démonstration",
    })),
  });

  // Compte de l'espace avocat (mot de passe de démonstration : « barreau »).
  await prisma.user.upsert({
    where: { email: "avocat.demo@demo.invalid" },
    update: {},
    create: { nom: `Me ${nomDe(0)}`, email: "avocat.demo@demo.invalid", role: "AVOCAT", membreId: ids.get(0)!, passwordHash: bcrypt.hashSync("barreau", 10), actif: true },
  });

  if (args.includes("--mots-de-passe-aleatoires")) await changerMotsDePasse();
  await appliquerIdentite();
}

/** Mots de passe aléatoires pour les comptes de démonstration : affichés une seule fois, jamais écrits. */
async function changerMotsDePasse() {
  const { randomBytes } = await import("node:crypto");
  const emails = ["batonnier@barreau-pn.cg", "sg@barreau-pn.cg", "tresoriere@barreau-pn.cg", "admin@barreau-pn.cg", "avocat.demo@demo.invalid"];
  console.log("MOTS DE PASSE (affichés une seule fois, à noter maintenant) :");
  for (const email of emails) {
    const mdp = randomBytes(9).toString("base64url");
    const r = await prisma.user.updateMany({ where: { email }, data: { passwordHash: bcrypt.hashSync(mdp, 10) } });
    if (r.count) console.log(`  ${email}  ${mdp}`);
  }
}

/** Identité de démonstration : logo générique, mention C-13 ; « pointe-noire » = retour aux défauts. */
async function appliquerIdentite() {
  if (!identiteVoulue) return;
  const ligne = await prisma.parametres.findUnique({ where: { id: 1 } });
  const data = { ...((ligne?.data as Record<string, unknown> | null) ?? {}) };
  if (identiteVoulue === "demonstration") {
    const logo = fs.readFileSync(fileURLToPath(new URL("../assets/demo/logo-demonstration.png", import.meta.url))).toString("base64");
    data.identite = {
      denomination: "Barreau de démonstration", ville: "Ville de démonstration",
      batonnier: "Me DEMO Bâtonnier", tresoriere: "Me DEMO Trésorière", secretaireGeneral: "Me DEMO Secrétaire général",
      adresse: "Maison de l'Avocat — Ville de démonstration", courriel: "contact@demo.invalid", site: "", telephones: "",
      logo: `data:image/png;base64,${logo}`, modeDemonstration: true,
    };
  } else delete data.identite;
  await prisma.parametres.upsert({ where: { id: 1 }, update: { data: data as object }, create: { id: 1, data: data as object } });
}

/** Effectifs du jeu de démonstration (preuve d'idempotence : identiques après chaque exécution). */
async function effectifs() {
  const plage = { gte: NUM0, lte: NUM0 + 199 };
  const membres = await prisma.membre.groupBy({ by: ["qualite", "statut"], where: { num: plage }, _count: true });
  const ids = (await prisma.membre.findMany({ where: { num: plage }, select: { id: true } })).map((m) => m.id);
  return {
    membres: Object.fromEntries(membres.map((g) => [`${g.qualite}/${g.statut}`, g._count])),
    cabinets: await prisma.cabinet.count({ where: { nom: { endsWith: "(DEMO)" } } }),
    cotisations: await prisma.cotisation.count({ where: { membreId: { in: ids } } }),
    recus: await prisma.recu.count({ where: { membreId: { in: ids } } }),
    dossiers: await prisma.dossierDisciplinaire.count({ where: { reference: { startsWith: "DEMO-" } } }),
    evenements: await prisma.evenementSituation.count({ where: { membreId: { in: ids } } }),
    scrutins: await prisma.scrutin.count({ where: { titre: { startsWith: "[DEMO]" } } }),
    fils: await prisma.conversation.count({ where: { sujet: { startsWith: "[DEMO]" } } }),
    messages: await prisma.message.count({ where: { conversation: { sujet: { startsWith: "[DEMO]" } } } }),
    timbres: await prisma.timbre.count({ where: { code: { startsWith: "DEMOTIMBRE" } } }),
    timbresExternes: await prisma.timbreExterne.count({ where: { reference: { startsWith: "DEMO-EXT-" } } }),
  };
}

try {
  await main();
  console.log("EFFECTIFS", JSON.stringify(await effectifs()));
} finally {
  await prisma.$disconnect();
}
