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
  if (s) {
    // Un secret court est trivialement attaquable par force brute (forge de jetons).
    if (nodeEnv === "production" && s.length < 32) {
      throw new Error("JWT_SECRET trop court (32 caractères minimum requis en production).");
    }
    return s;
  }
  if (nodeEnv === "production") {
    throw new Error("Variable d'environnement obligatoire en production : JWT_SECRET");
  }
  return "dev-secret";
}

/**
 * Avertit au démarrage des configurations qui, absentes, dégradent SILENCIEUSEMENT
 * en production (échec à l'usage plutôt qu'au boot). N'interrompt pas le démarrage —
 * un déploiement peut légitimement tourner en simulation — mais rend le défaut visible.
 */
export function verifierConfigProduction(avertir: (msg: string) => void): void {
  if (nodeEnv !== "production") return;
  if (process.env.PAYMENT_PROVIDER && !process.env.PAYMENT_WEBHOOK_SECRET) {
    avertir("PAYMENT_PROVIDER défini mais PAYMENT_WEBHOOK_SECRET absent : tous les webhooks de paiement seront rejetés.");
  }
  if (!process.env.SIGNATURE_PRIVATE_KEY && !process.env.SIGNATURE_KEY_DIR) {
    avertir("Clés de signature non configurées : une clé éphémère sera générée et invalidera les QR émis à chaque redémarrage.");
  }
  if (!process.env.SMTP_HOST && !process.env.SMTP_URL) {
    avertir("SMTP non configuré : les notifications email resteront en simulation.");
  }
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
