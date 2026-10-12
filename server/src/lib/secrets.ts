import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Secrets des paramètres (mots de passe SMTP, clés de passerelles, clé SMS) :
 * chiffrés au repos en AES-256-GCM avec la clé PARAMS_CLE (32 octets en base64,
 * variable d'environnement, jamais en base ni dans Git). Format stocké :
 * « enc:v1:<iv>:<tag>:<chiffré> » (base64). Les secrets ne quittent jamais
 * l'API en clair : seule leur forme masquée est renvoyée.
 */
const PREFIXE = "enc:v1:";
export const MASQUE = "••••";

/** Liste FERMÉE des chemins secrets dans Parametres.data. */
export const CHEMINS_SECRETS = [
  "smtp.pass",
  "notifications.sms.cleApi",
  "passerelles.mtn.abonnementCle",
  "passerelles.mtn.cleSecrete",
  "passerelles.airtel.cleSecrete",
  "passerelles.agregateur.cleApi",
  "passerelles.agregateur.cleWebhook",
] as const;

/** Vrai si PARAMS_CLE est présente ET valide (32 octets). */
export const cleDisponible = () => { try { cle(); return true; } catch { return false; } };

function cle(): Buffer {
  const b64 = process.env.PARAMS_CLE;
  if (!b64) throw new Error("PARAMS_CLE absente : impossible de chiffrer ou de déchiffrer un secret.");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("PARAMS_CLE invalide : 32 octets encodés en base64 attendus.");
  return k;
}

export function chiffrer(clair: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle(), iv);
  const ct = Buffer.concat([c.update(clair, "utf8"), c.final()]);
  return PREFIXE + [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(":");
}

/** Déchiffre ; une valeur sans préfixe (ancien smtp.pass en clair) est renvoyée telle quelle. Lève si altérée. */
export function dechiffrer(valeur: string): string {
  if (!valeur.startsWith(PREFIXE)) return valeur;
  const [iv, tag, ct] = valeur.slice(PREFIXE.length).split(":").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !ct || iv.length !== 12 || tag.length !== 16) throw new Error("Secret chiffré mal formé.");
  const d = createDecipheriv("aes-256-gcm", cle(), iv, { authTagLength: 16 }); // tag de 128 bits imposé (Semgrep gcm-no-tag-length)
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

/**
 * Forme affichable d'un secret stocké : « •••• » + 4 derniers caractères, et
 * seulement « •••• » pour un secret de moins de 12 caractères (4 caractères
 * révélés d'un mot de passe court en livreraient une part trop grande).
 */
export function masquer(valeur: string): string {
  if (!valeur) return "";
  let clair = "";
  try { clair = dechiffrer(valeur); } catch { /* illisible (clé absente ou altérée) : masque nu */ }
  return MASQUE + (clair.length >= 12 ? clair.slice(-4) : "");
}

/** Lecture d'un chemin pointé (« a.b.c ») dans un objet. */
export function lireChemin(o: unknown, chemin: string): unknown {
  return chemin.split(".").reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string, unknown>)[k] : undefined), o);
}

/** Écriture d'un chemin pointé ; crée les objets intermédiaires (copiés, l'original n'est pas muté). */
export function ecrireChemin(o: Record<string, unknown>, chemin: string, v: unknown): void {
  const cles = chemin.split(".");
  let x = o;
  for (const k of cles.slice(0, -1)) {
    const suivant = x[k];
    x = x[k] = suivant && typeof suivant === "object" ? { ...(suivant as object) } : {};
  }
  if (v === undefined) delete x[cles[cles.length - 1]];
  else x[cles[cles.length - 1]] = v;
}

/** Copie de `data` où chaque secret présent est remplacé par sa forme masquée. */
export function masquerSecrets<T extends Record<string, unknown>>(data: T): T {
  const copie = { ...data } as Record<string, unknown>;
  for (const c of CHEMINS_SECRETS) {
    const v = lireChemin(copie, c);
    if (typeof v === "string") ecrireChemin(copie, c, masquer(v));
  }
  return copie as T;
}
