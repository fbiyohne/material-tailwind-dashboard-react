import "dotenv/config";

function requis(nom: string, defaut?: string): string {
  const v = process.env[nom] ?? defaut;
  if (v === undefined) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

/**
 * Secret de signature JWT. Aucun repli en production : un secret par défaut
 * permettrait la forge de jetons (élévation ADMIN). Le repli « dev-secret »
 * n'est toléré qu'en développement/test.
 */
function secretJwt(): string {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (nodeEnv === "production") {
    throw new Error("Variable d'environnement obligatoire en production : JWT_SECRET");
  }
  return "dev-secret";
}

export const env = {
  nodeEnv,
  databaseUrl: requis("DATABASE_URL"),
  jwtSecret: secretJwt(),
  port: Number(requis("PORT", "4000")),
  clientOrigin: requis("CLIENT_ORIGIN", "http://localhost:5173"),
  accessTtl: requis("ACCESS_TTL", "15m"),
  refreshTtlDays: Number(requis("REFRESH_TTL_DAYS", "7")),
  // Dossier du front compilé à servir avec l'API (déploiement mono-service).
  // Vide → l'API ne sert que /api (comportement de développement).
  staticDir: process.env.STATIC_DIR ?? "",
};
