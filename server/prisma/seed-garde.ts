/**
 * Garde-fou du seed (R2-1), importé EN PREMIER par seed.ts pour s'évaluer avant tout module
 * applicatif (src/env.ts lève une erreur en production, src/prisma.ts ouvre le client).
 * Le seed vide toutes les tables et crée des comptes (dont l'ADMIN) au mot de passe commun
 * « barreau », publié dans ce dépôt public. Il ne tourne donc jamais en production ni sur une
 * base distante (la production est sur panel.creatic.cg) : poste local ou socle seulement.
 * Un compte ADMIN de production est nominatif, au mot de passe fort (condition C7).
 */
import "dotenv/config";

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]", "postgres"];

function refuser(motif: string): never {
  console.error(`seed refusé : ${motif} Aucune écriture effectuée.`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") refuser("NODE_ENV=production.");
let hote = "";
try {
  hote = new URL(process.env.DATABASE_URL ?? "").hostname;
} catch {
  refuser("DATABASE_URL absent ou illisible.");
}
if (!HOTES_LOCAUX.includes(hote)) refuser(`l'hôte « ${hote} » n'est pas local (${HOTES_LOCAUX.join(", ")}).`);
