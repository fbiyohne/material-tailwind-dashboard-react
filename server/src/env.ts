import "dotenv/config";

function requis(nom: string, defaut?: string): string {
  const v = process.env[nom] ?? defaut;
  if (v === undefined) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: requis("DATABASE_URL"),
  jwtSecret: requis("JWT_SECRET", "dev-secret"),
  port: Number(requis("PORT", "4000")),
  clientOrigin: requis("CLIENT_ORIGIN", "http://localhost:5173"),
  accessTtl: requis("ACCESS_TTL", "15m"),
  refreshTtlDays: Number(requis("REFRESH_TTL_DAYS", "7")),
  // Dossier du front compilé à servir avec l'API (déploiement mono-service).
  // Vide → l'API ne sert que /api (comportement de développement).
  staticDir: process.env.STATIC_DIR ?? "",
};
