import bcrypt from "bcryptjs";
import { prisma } from "../src/prisma.js";
import { montantDu } from "../src/lib/business.js";
// Réutilise les données d'échantillon du front (source unique pour le prototype).
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
  }

  // Quitus de référence (BIKINDOU, exercice 2026) + archive
  const bikindou = await prisma.membre.findFirst({ where: { num: 3 } });
  if (bikindou) {
    await prisma.quitus.create({ data: { numero: "Q-2026-089", membreId: bikindou.id, annee: 2026, dateEmission: new Date("2026-05-20") } });
    await prisma.archive.create({
      data: { categorie: "Quitus", titre: `Quitus Q-2026-089 — Me ${bikindou.nom}`, reference: "Q-2026-089", date: new Date("2026-05-20"), membreNom: bikindou.nom },
    });
  }

  const nbMembres = await prisma.membre.count();
  console.log(`Seed terminé : ${nbMembres} membres, 4 utilisateurs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
