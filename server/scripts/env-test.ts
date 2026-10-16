// Doit être le PREMIER import d'un script de contrôle : bascule Prisma sur la base de test avant
// que src/prisma.ts ne soit chargé, et refuse toute autre base (jamais barreau_pn).
import "dotenv/config";
if (process.argv.includes("--production")) {
  const url = process.env.TEST_DATABASE_URL ?? "";
  if (!/\/barreau_pn_test(\?|$)/.test(url)) throw new Error("TEST_DATABASE_URL doit viser barreau_pn_test : contrôle refusé.");
  process.env.DATABASE_URL = url;
}
