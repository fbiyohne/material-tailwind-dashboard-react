/**
 * Purge des restes laissés par la suite de tests dans barreau_pn_test.
 *
 * Plusieurs blocs de api.test.ts n'ont pas de afterAll (ou échouent avant lui) et laissent
 * leurs fixtures en base à chaque exécution. Effets mesurés le 2026-10-10 (4 699 membres,
 * dont 20 réels issus du seed) : plus de 200 RADIE font échouer C-03 (pageSize=200), les
 * restes « R25 » entrent en collision de numInscription avec R2-5, et un reçu accroché à
 * « T10 Hostile » bloque le afterAll du bloc T10.
 *
 * Cible : tout membre dont le nom commence par un préfixe de fixture, quel que soit son
 * statut ou son num, et ses lignes liées sans cascade (reçus, paiements, quitus). Les
 * membres du seed (ABIRA, BAKALA… num 1 à 20) et toute autre ligne ne sont jamais touchés.
 *
 * Appelée automatiquement par test/globalSetup.ts (sous le verrou de la suite) ; à la main :
 *   npx tsx prisma/purger-restes-tests.ts            # simulation : affiche les effectifs
 *   npx tsx prisma/purger-restes-tests.ts --executer # suppression effective
 *
 * Garde-fou : refuse toute base dont le nom n'est pas exactement barreau_pn_test.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

export const URL_TEST = process.env.TEST_DATABASE_URL || "postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test?schema=public";

/** Préfixes de noms propres aux fixtures (api.test.ts, cycleVie-situation, migrations, pieces-rejet…). */
export const PREFIXES_FIXTURES = [
  "E2E ", "ZZE2E", "R25 ", "R22 ", "RELDROIT ", "VS ", "STAGE ", "AVOC ", "ESPACE ", "ESPATT ", "DISC ",
  "TIMBRE ", "DEMANDE ", "DROIT ", "TEST ", "OVERPAY ", "DOUBLEPAY ", "SUPPR-RECU ", "COT-SUPPR ",
  "QUI-SUPPR ", "SUPPR-CASCADE", "SUPPR-RBAC", "T10 ", "T6 ", "T5 ", "T4 ", "T2 ", "IMPORT ", "DECEDE ",
  "ATTEST-RADIE", "ATTEST-DECEDE", "PARITE ", "CAB ", "RENVOI ", "NOEMAIL ", "REJET PIECE",
];

export async function purgerRestesTests(prisma: PrismaClient, executer: boolean) {
  if (new URL(URL_TEST).pathname !== "/barreau_pn_test") throw new Error(`Refus : la base ciblée n'est pas barreau_pn_test (${new URL(URL_TEST).pathname}).`);
  const cible = { OR: PREFIXES_FIXTURES.map((p) => ({ nom: { startsWith: p } })) };
  const membres = await prisma.membre.findMany({ where: cible, select: { id: true, statut: true } });
  const ids = membres.map((m) => m.id);
  const parMembre = { where: { membreId: { in: ids } } };
  const [recus, paiements, quitus] = await Promise.all([prisma.recu.count(parMembre), prisma.paiement.count(parMembre), prisma.quitus.count(parMembre)]);
  const bilan = { membres: ids.length, radies: membres.filter((m) => m.statut === "RADIE").length, recus, paiements, quitus };
  if (!executer || !ids.length) return bilan;
  // Reçus, paiements et quitus n'ont pas de cascade : retirés d'abord. Le reste (cotisations,
  // pièces, événements, compte espace…) suit par cascade ; les dossiers disciplinaires sont détachés (SetNull).
  await prisma.$transaction([
    prisma.recu.deleteMany(parMembre),
    prisma.paiement.deleteMany(parMembre),
    prisma.quitus.deleteMany(parMembre),
    prisma.membre.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return bilan;
}

// Exécution directe (npx tsx prisma/purger-restes-tests.ts [--executer]).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const prisma = new PrismaClient({ datasources: { db: { url: URL_TEST } } });
  const executer = process.argv.includes("--executer");
  purgerRestesTests(prisma, executer)
    .then(async (bilan) => {
      console.log(`Base ${new URL(URL_TEST).pathname} — ${executer ? "supprimé" : "simulation (rien n'est supprimé, ajouter --executer)"} :`, bilan);
      const restes = await prisma.membre.groupBy({ by: ["statut"], _count: true });
      console.log("Membres restants par statut :", Object.fromEntries(restes.map((r) => [r.statut, r._count])));
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
