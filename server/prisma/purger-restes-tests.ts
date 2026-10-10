/**
 * Purge des restes laissés par la suite de tests dans barreau_pn_test.
 *
 * Plusieurs blocs de api.test.ts (RELDROIT, R25, VS…) créent des membres RADIE sans
 * les supprimer ; au-delà de 200 RADIE, le test C-03 (pageSize=200) échoue, et un
 * reçu accroché à « T10 Hostile » fait échouer le afterAll du bloc T10. Ce script
 * supprime uniquement ces fixtures, jamais les autres membres de la base.
 *
 * Usage (depuis server/) :
 *   npx tsx prisma/purger-restes-tests.ts            # simulation : affiche les effectifs
 *   npx tsx prisma/purger-restes-tests.ts --executer # suppression effective
 *
 * Garde-fou : refuse toute base dont le nom n'est pas exactement barreau_pn_test.
 * Suppression de données : à lancer uniquement après validation explicite.
 */
import { PrismaClient } from "@prisma/client";

const URL_TEST = process.env.TEST_DATABASE_URL || "postgresql://barreau:barreau_dev@127.0.0.1:5432/barreau_pn_test?schema=public";
if (new URL(URL_TEST).pathname !== "/barreau_pn_test") {
  console.error(`Refus : la base ciblée n'est pas barreau_pn_test (${new URL(URL_TEST).pathname}).`);
  process.exit(2);
}
const prisma = new PrismaClient({ datasources: { db: { url: URL_TEST } } });

/** Préfixes de noms propres aux fixtures de api.test.ts. */
const PREFIXES = ["RELDROIT ", "R25 ", "VS ", "T10 ", "E2E ", "ESPATT ", "ATTEST-RADIE", "ZZE2E"];
// Seuls les RADIE résiduels et le bloc T10 (dont « T10 Hostile » et son reçu) sont visés.
const cible = {
  OR: [
    { statut: "RADIE" as const, OR: PREFIXES.map((p) => ({ nom: { startsWith: p } })) },
    { nom: { startsWith: "T10 " } },
  ],
};

async function main() {
  const executer = process.argv.includes("--executer");
  const membres = await prisma.membre.findMany({ where: cible, select: { id: true, nom: true, statut: true } });
  const ids = membres.map((m) => m.id);
  const parMembre = { where: { membreId: { in: ids } } };
  const [recus, paiements, quitus] = await Promise.all([
    prisma.recu.count(parMembre),
    prisma.paiement.count(parMembre),
    prisma.quitus.count(parMembre),
  ]);
  const parPrefixe = Object.fromEntries(
    PREFIXES.map((p) => [p.trim(), membres.filter((m) => m.nom.startsWith(p)).length]).filter(([, n]) => n),
  );
  console.log(`Base : ${new URL(URL_TEST).pathname} — membres ciblés : ${ids.length}`, parPrefixe);
  console.log(`Lignes liées sans cascade : reçus ${recus}, paiements ${paiements}, quitus ${quitus}`);
  if (!executer) {
    console.log("Simulation : rien n'est supprimé (ajouter --executer).");
    return;
  }
  // Les relations Recu, Paiement et Quitus n'ont pas de cascade : on les retire d'abord.
  const r = await prisma.$transaction([
    prisma.recu.deleteMany(parMembre),
    prisma.paiement.deleteMany(parMembre),
    prisma.quitus.deleteMany(parMembre),
    prisma.membre.deleteMany({ where: { id: { in: ids } } }),
  ]);
  console.log(`Supprimé : reçus ${r[0].count}, paiements ${r[1].count}, quitus ${r[2].count}, membres ${r[3].count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
