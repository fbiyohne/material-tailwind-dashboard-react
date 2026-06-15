import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";
import { montantDu, DROIT_PLAIDOIRIE } from "../src/lib/business.js";
// Réutilise les données d'échantillon du front (source unique pour le prototype).
// @ts-ignore — module JavaScript du front, sans déclarations de types.
import { membres as membresFront } from "../../src/barreau/data/membres.js";

const QUALITE: Record<string, "AVOCAT" | "STAGIAIRE" | "HONORAIRE"> = {
  avocat: "AVOCAT",
  stagiaire: "STAGIAIRE",
  honoraire: "HONORAIRE",
};
const STATUT: Record<string, any> = {
  inscrit: "INSCRIT",
  suspendu: "SUSPENDU",
  honoraire: "HONORAIRE",
  omis: "OMIS",
  stagiaire: "STAGIAIRE",
  radie: "RADIE",
};
const VALIDES_2026 = new Set([2, 3, 4, 9, 10]); // situations validées par la Trésorière

const hash = (p: string) => bcrypt.hashSync(p, 10);

async function main() {
  // Réinitialisation
  await prisma.$transaction([
    prisma.archive.deleteMany(),
    prisma.quitus.deleteMany(),
    prisma.recu.deleteMany(),
    prisma.cotisation.deleteMany(),
    prisma.droitPlaidoirie.deleteMany(),
    prisma.dossierDisciplinaire.deleteMany(),
    prisma.membre.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Comptes utilisateurs (4 rôles) — mot de passe : « barreau »
  await prisma.user.createMany({
    data: [
      { nom: "Me KALINA-MENGA Lionel", email: "sg@barreau-pn.cg", role: "SECRETAIRE_GENERAL", passwordHash: hash("barreau") },
      { nom: "Me BIKINDOU Audrey Séverin", email: "batonnier@barreau-pn.cg", role: "BATONNIER", passwordHash: hash("barreau") },
      { nom: "Me ONDZE BOYA Armelle", email: "tresoriere@barreau-pn.cg", role: "TRESORIERE", passwordHash: hash("barreau") },
      { nom: "Administrateur système", email: "admin@barreau-pn.cg", role: "ADMIN", passwordHash: hash("barreau") },
    ],
  });

  // Membres + cotisations (depuis les données du front)
  for (const m of membresFront as any[]) {
    const qualite = QUALITE[m.qualite] ?? "AVOCAT";
    const membre = await prisma.membre.create({
      data: {
        num: m.num,
        numInscription: m.numInscription ?? null,
        nom: m.nom,
        qualite,
        statut: STATUT[m.statut] ?? "INSCRIT",
        cabinet: m.cabinet ?? null,
        tel: m.tel ?? null,
        email: m.email ?? null,
        rccm: m.rccm ?? null,
        dateInscription: m.dateInscription ? new Date(m.dateInscription) : null,
        dateServment: m.stage?.dateServment ? new Date(m.stage.dateServment) : null,
        dureeMois: m.stage?.dureeMois ?? null,
        maitreStage: m.stage?.maitreStage ?? null,
      },
    });

    for (const [annee, p] of Object.entries(m.paiements ?? {})) {
      const a = Number(annee);
      const paiement = p as any;
      await prisma.cotisation.create({
        data: {
          membreId: membre.id,
          annee: a,
          montantDu: montantDu(qualite),
          montantPaye: paiement.paye ?? 0,
          datePaiement: paiement.date ? new Date(paiement.date) : null,
          mode: paiement.mode ?? null,
          ref: paiement.ref ?? null,
          valideTresoriere: a === 2026 && VALIDES_2026.has(m.num),
        },
      });
    }

    // Droits de plaidoirie 2026 (avocats) — données réelles persistées (FR-DROITS).
    if (qualite === "AVOCAT") {
      const paye = [0, Math.round(DROIT_PLAIDOIRIE / 2), DROIT_PLAIDOIRIE][m.num % 3];
      await prisma.droitPlaidoirie.create({
        data: {
          membreId: membre.id,
          annee: 2026,
          montantDu: DROIT_PLAIDOIRIE,
          montantPaye: paye,
          datePaiement: paye ? new Date("2026-03-15") : null,
          mode: paye ? "Espèces" : null,
        },
      });
    }
  }

  // Quitus de référence (BIKINDOU, exercice 2026) + archive
  const bikindou = await prisma.membre.findFirst({ where: { num: 3 } });
  if (bikindou) {
    await prisma.quitus.create({ data: { numero: "Q-2026-089", membreId: bikindou.id, annee: 2026, dateEmission: new Date("2026-05-20") } });
    await prisma.archive.create({
      data: { categorie: "Quitus", titre: `Quitus Q-2026-089 — Me ${bikindou.nom}`, reference: "Q-2026-089", date: new Date("2026-05-20"), membreNom: bikindou.nom },
    });
  }

  // Données institutionnelles
  await prisma.reunion.deleteMany();
  await prisma.assemblee.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.dossierDisciplinaire.deleteMany();

  await prisma.reunion.createMany({
    data: [
      { date: new Date("2026-06-18"), heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", ordreDuJour: ["Approbation du procès-verbal précédent", "Point sur le recouvrement des cotisations 2026", "Préparation de l'AGO", "Questions diverses"], statut: "planifiee" },
      { date: new Date("2026-05-14"), heure: "15:00", lieu: "Maison de l'Avocat — Pointe-Noire", ordreDuJour: ["Admissions sur la liste de stage", "Questions diverses"], statut: "tenue", pv: "Le Conseil a admis deux nouveaux stagiaires." },
    ],
  });

  await prisma.assemblee.create({
    data: { type: "AGO", date: new Date("2026-07-15"), lieu: "Palais de Justice — Pointe-Noire", ordreDuJour: ["Rapport moral du Bâtonnier", "Rapport financier de la Trésorière", "Renouvellement du Conseil de l'Ordre"], statut: "convoquee" },
  });

  await prisma.publication.createMany({
    data: [
      { titre: "Avis de fermeture du Secrétariat — congés annuels", type: "Avis", contenu: "Le Secrétariat sera fermé du 1er au 15 août 2026.", statut: "PUBLIE", date: new Date("2026-06-01") },
      { titre: "Communiqué — Rentrée solennelle du Barreau", type: "Communiqué", contenu: "Le Bâtonnier annonce la tenue de la rentrée solennelle du Barreau.", statut: "A_VALIDER", date: new Date("2026-06-10") },
    ],
  });

  const mavoungou = await prisma.membre.findFirst({ where: { num: 8 } });
  await prisma.dossierDisciplinaire.createMany({
    data: [
      { reference: "2026-03", membreId: mavoungou?.id ?? null, avocatNom: "MAVOUNGOU Chris", objet: "Manquement présumé aux règles déontologiques", dateSaisine: new Date("2026-03-10"), dateConvocation: new Date("2026-03-25"), dateAudience: new Date("2026-04-15"), statut: "INSTRUCTION" },
      { reference: "2026-04", avocatNom: "Confidentiel", objet: "Plainte d'un justiciable", dateSaisine: new Date("2026-05-02"), statut: "OUVERT" },
    ],
  });

  // Composition du Conseil de l'Ordre (feuilles de présence des réunions)
  await prisma.membreConseil.deleteMany();
  await prisma.membreConseil.createMany({
    data: [
      { nom: "Me BIKINDOU Audrey Séverin", fonction: "Bâtonnier", ordre: 1 },
      { nom: "Me ONDZE BOYA Armelle Laure Carine", fonction: "Trésorière", ordre: 2 },
      { nom: "Me KALINA-MENGA Lionel", fonction: "Secrétaire Général", ordre: 3 },
    ],
  });

  // Calendrier éditorial de la Lettre du Bâtonnier
  await prisma.calendrierEditorial.deleteMany();
  await prisma.calendrierEditorial.createMany({
    data: [
      { mois: "Mars 2026", theme: "Déontologie et secret professionnel", statut: "publie", ordre: 1 },
      { mois: "Avril 2026", theme: "L'accès au droit pour tous", statut: "publie", ordre: 2 },
      { mois: "Mai 2026", theme: "La formation continue de l'avocat", statut: "publie", ordre: 3 },
      { mois: "Juin 2026", theme: "Le rôle social du Barreau", statut: "a_rediger", ordre: 4 },
      { mois: "Juillet 2026", theme: "Justice et numérique au Congo", statut: "a_rediger", ordre: 5 },
      { mois: "Août 2026", theme: "L'indépendance de la profession", statut: "a_rediger", ordre: 6 },
    ],
  });

  const nbMembres = await prisma.membre.count();
  console.log(`Seed terminé : ${nbMembres} membres, 4 utilisateurs, données institutionnelles.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
