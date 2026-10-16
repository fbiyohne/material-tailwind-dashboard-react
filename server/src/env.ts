import "dotenv/config";

function requis(nom: string, defaut?: string): string {
  const v = process.env[nom] ?? defaut;
  if (v === undefined) throw new Error(`Variable d'environnement manquante : ${nom}`);
  return v;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

/**
 * NOMBRE de sauts de proxy de confiance pour `trust proxy` (défaut 1, un
 * reverse-proxy ; « 2 » derrière LB + nginx). On n'accepte QUE des entiers :
 * `trust proxy: true` ferait planter express-rate-limit v8
 * (ERR_ERL_PERMISSIVE_TRUST_PROXY) à la première requête sur un endpoint limité.
 */
function trustProxy(): number {
  const n = Number(process.env.TRUST_PROXY ?? "1");
  return Number.isInteger(n) && n >= 0 ? n : 1;
}

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
 * Exceptions bloquantes : VERIF_BASCULE, clés de signature, PUBLIC_ORIGIN (voir ci-dessous).
 */
export function verifierConfigProduction(avertir: (msg: string) => void): void {
  // Relu à l'appel (et non la constante du module) pour rester testable.
  if ((process.env.NODE_ENV ?? "development") !== "production") return;
  // Aucun défaut en production : une date figée fermerait en silence /api/verifier
  // pour des documents authentiques émis avec l'ancien QR avant le déploiement.
  const bascule = process.env.VERIF_BASCULE;
  if (!bascule || Number.isNaN(new Date(bascule).getTime())) {
    throw new Error("VERIF_BASCULE absente ou illisible : obligatoire en production (date ISO AAAA-MM-JJ de mise en service du chemin /v).");
  }
  if (process.env.PAYMENT_PROVIDER && !process.env.PAYMENT_WEBHOOK_SECRET) {
    avertir("PAYMENT_PROVIDER défini mais PAYMENT_WEBHOOK_SECRET absent : tous les webhooks de paiement seront rejetés.");
  }
  // R1-1 : le jeton QR dérive de la clé de signature ; une clé éphémère change à chaque
  // redémarrage et rendrait « Non reconnu » tous les documents authentiques déjà imprimés.
  if (!(process.env.SIGNATURE_PRIVATE_KEY && process.env.SIGNATURE_PUBLIC_KEY) && !process.env.SIGNATURE_KEY_DIR) {
    throw new Error("SIGNATURE_PRIVATE_KEY et SIGNATURE_PUBLIC_KEY absentes (et pas de SIGNATURE_KEY_DIR persistant) : obligatoires en production (clé dont dérivent les jetons QR des documents).");
  }
  if (!process.env.SMTP_HOST && !process.env.SMTP_URL) {
    avertir("SMTP non configuré : les notifications email resteront en simulation.");
  }
  // Les QR sont imprimés : une origine absente ou non chiffrée les rendrait invérifiables ou exposés (R1-6).
  if (!/^https:\/\//.test(process.env.PUBLIC_ORIGIN ?? "")) {
    throw new Error("PUBLIC_ORIGIN absente ou non https:// : obligatoire en production (origine publique encodée dans les QR des documents).");
  }
  if (!process.env.PARAMS_CLE) {
    avertir("PARAMS_CLE absente : aucun secret (SMTP, passerelles, SMS) ne peut être enregistré chiffré depuis les Paramètres.");
  }
}

export const env = {
  nodeEnv,
  databaseUrl: requis("DATABASE_URL"),
  jwtSecret: secretJwt(),
  port: Number(requis("PORT", "4000")),
  // Interface d'écoute : défaut = toutes (production) ; « 127.0.0.1 » pour une démonstration sur réseau partagé.
  host: process.env.HOST || "0.0.0.0",
  clientOrigin: requis("CLIENT_ORIGIN", "http://localhost:5173"),
  accessTtl: requis("ACCESS_TTL", "15m"),
  refreshTtlDays: Number(requis("REFRESH_TTL_DAYS", "7")),
  trustProxy: trustProxy(),
  // Dossier du front compilé à servir avec l'API (déploiement mono-service).
  // Vide → l'API ne sert que /api (comportement de développement).
  staticDir: process.env.STATIC_DIR ?? "",
};
