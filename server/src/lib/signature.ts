import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { logger } from "./logger.js";

/**
 * Code de vérification des documents officiels — signature RSA-2048 / SHA-256
 * interne (clé privée du Barreau, clé publique distribuable), sans portée légale :
 * ce n'est ni une signature électronique au sens légal ni un certificat qualifié.
 */
const keyDir = process.env.SIGNATURE_KEY_DIR || path.resolve("secrets");

/**
 * Charge la paire de clés des documents. En production, toute situation qui
 * produirait une clé éphémère (dossier absent, paire illisible ou incomplète,
 * persistance impossible) refuse le démarrage : sinon un redémarrage changerait
 * les jetons QR et les documents imprimés deviendraient « Non reconnu » (R1-1, R2-7).
 */
export function chargerCles(dir = keyDir): { privateKey: string; publicKey: string } {
  if (process.env.SIGNATURE_PRIVATE_KEY && process.env.SIGNATURE_PUBLIC_KEY) {
    return { privateKey: process.env.SIGNATURE_PRIVATE_KEY, publicKey: process.env.SIGNATURE_PUBLIC_KEY };
  }
  const prod = process.env.NODE_ENV === "production";
  const privPath = path.join(dir, "signing-private.pem");
  const pubPath = path.join(dir, "signing-public.pem");
  const presentes = [privPath, pubPath].filter((p) => fs.existsSync(p)).length;
  if (presentes === 2) {
    try {
      return { privateKey: fs.readFileSync(privPath, "utf8"), publicKey: fs.readFileSync(pubPath, "utf8") };
    } catch (e) {
      if (prod) throw new Error(`Clés de signature illisibles dans ${dir} : démarrage refusé en production (aucune clé de remplacement générée).`);
      logger.warn({ err: e }, "Lecture des clés de signature échouée — repli sur génération.");
    }
  } else if (presentes === 1 && prod) {
    // Régénérer écraserait la moitié restante de la paire : on refuse.
    throw new Error(`Paire de clés de signature incomplète dans ${dir} : démarrage refusé en production.`);
  }
  // Aucune clé fournie ni persistée : on en génère (acceptable en dev, ou au premier
  // démarrage sur un SIGNATURE_KEY_DIR persistant, à condition que l'écriture réussisse).
  if (prod && !process.env.SIGNATURE_KEY_DIR) {
    throw new Error("Clés de signature absentes en production : configurez SIGNATURE_PRIVATE_KEY et SIGNATURE_PUBLIC_KEY, ou un SIGNATURE_KEY_DIR persistant.");
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(pubPath, publicKey);
    // Relecture : la paire écrite doit être celle qu'on utilise.
    if (fs.readFileSync(privPath, "utf8") !== privateKey || fs.readFileSync(pubPath, "utf8") !== publicKey) {
      throw new Error("relecture des clés persistées divergente");
    }
  } catch (e) {
    if (prod) throw new Error(`Persistance des clés de signature impossible dans ${dir} : démarrage refusé en production (clé éphémère interdite).`);
    logger.warn({ err: e }, "Persistance des clés de signature impossible (FS en lecture seule) — clés gardées en mémoire.");
  }
  return { privateKey, publicKey };
}

const { privateKey, publicKey } = chargerCles();

/** Empreinte courte de la clé publique (identifiant du signataire). */
export const empreinteCle = crypto.createHash("sha256").update(publicKey).digest("hex").slice(0, 16);
export const clePublique = publicKey;

/** Signe un payload (RSA-SHA256) → signature base64. */
export function signerDocument(payload: string): string {
  return crypto.sign("sha256", Buffer.from(payload), privateKey).toString("base64");
}

/** Vérifie une signature base64 contre la clé publique. */
export function verifierDocument(payload: string, signatureB64: string): boolean {
  try {
    return crypto.verify("sha256", Buffer.from(payload), publicKey, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

export const quitusPayload = (q: { numero: string; membreId: number; annee: number; dateEmission: Date | string }) =>
  `QUITUS|${q.numero}|${q.membreId}|${q.annee}|${new Date(q.dateEmission).toISOString().slice(0, 10)}`;

export const recuPayload = (r: { numero: string; membreId: number; annee: number; montant: number; date: Date | string }) =>
  `RECU|${r.numero}|${r.membreId}|${r.annee}|${r.montant}|${new Date(r.date).toISOString().slice(0, 10)}`;

export const timbrePayload = (t: { numero: number; code: string; membreId: number; montant: number }) =>
  `TIMBRE|${t.numero}|${t.code}|${t.membreId}|${t.montant}`;

/* ------------------------------------------------------------------------- *
 * Code de vérification des QR (quitus, reçus, timbres).
 * Le QR encode une URL courte {origine}/v/{q|r|t}/{ref}.{jeton}. Le jeton est
 * une HMAC-SHA256 tronquée (10 caractères base32 Crockford, 50 bits) de
 * « type|ref », sous la clé sha256("qr|" + DER de la clé privée des documents) : aucun
 * nouveau secret, distinct de PARAMS_CLE, jamais dans Git. Il est déterministe
 * (rien à stocker) et empêche d'énumérer les numéros séquentiels. Ce n'est
 * qu'un code d'authenticité, pas une signature au sens légal.
 * Rotation : l'ancienne clé privée (PEM) placée dans
 * SIGNATURE_ANCIENNE_PRIVATE_KEY sert uniquement à vérifier les QR déjà émis.
 * ------------------------------------------------------------------------- */
export type TypeDocQr = "q" | "r" | "t";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Jeton de 10 caractères pour (type, ref) sous la clé privée donnée (actuelle par défaut). */
export function jetonQr(type: TypeDocQr, ref: string, clePrivee: string = privateKey): string {
  // Dérivation sur la forme DER canonique : un PEM recollé (CRLF, espaces) garde le même jeton.
  const der = crypto.createPrivateKey(clePrivee).export({ type: "pkcs8", format: "der" });
  const cle = crypto.createHash("sha256").update("qr|").update(der).digest();
  const h = crypto.createHmac("sha256", cle).update(`${type}|${ref}`).digest();
  let bits = 0n;
  for (const o of h.subarray(0, 7)) bits = (bits << 8n) | BigInt(o); // 56 bits, on garde les 50 de tête
  let j = "";
  for (let i = 0; i < 10; i++) j += CROCKFORD[Number((bits >> BigInt(51 - 5 * i)) & 31n)];
  return j;
}

/** Chemin public court à encoder dans le QR : /v/{t}/{ref}.{jeton}. */
export const cheminVerif = (type: TypeDocQr, ref: string) => `/v/${type}/${ref}.${jetonQr(type, ref)}`;

/** Vrai si le jeton correspond à (type, ref) sous la clé actuelle ou l'ancienne clé configurée. */
export function jetonValide(type: TypeDocQr, ref: string, jeton: string): boolean {
  const recu = Buffer.from(String(jeton ?? ""));
  const cles = [privateKey, process.env.SIGNATURE_ANCIENNE_PRIVATE_KEY].filter(Boolean) as string[];
  let ok = false;
  for (const c of cles) {
    let attendu: Buffer;
    try { attendu = Buffer.from(jetonQr(type, ref, c)); } catch { continue; } // ancienne clé illisible : ignorée
    if (recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu)) ok = true;
  }
  return ok;
}

/**
 * Origine publique canonique des URL de vérification (R1-6) : PUBLIC_ORIGIN, à défaut
 * CLIENT_ORIGIN (origine du front). Jamais l'en-tête Host ni X-Forwarded-* de la requête :
 * un Host falsifié produirait sinon un document officiel, au jeton valide, pointant vers
 * un domaine hostile. Relue à chaque appel ; schéma limité à http/https, sinon erreur.
 */
export function originePublique(): string {
  const brut = process.env.PUBLIC_ORIGIN || process.env.CLIENT_ORIGIN || "http://localhost:5173";
  let u: URL | null = null;
  try { u = new URL(brut); } catch { /* traité ci-dessous */ }
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:")) {
    throw new Error("PUBLIC_ORIGIN (ou CLIENT_ORIGIN) invalide : URL http(s) attendue.");
  }
  return u.origin;
}

/** Hôte public imprimé sous le QR des gabarits (ex. « barreau-pn.onrender.com »). */
export const hotePublic = () => new URL(originePublique()).host;

/** URL absolue de vérification (origine canonique + chemin signé) : ce que le QR encode et ce que l'API renvoie dans `verif`. */
export const urlVerif = (type: TypeDocQr, ref: string) => originePublique() + cheminVerif(type, ref);

/** QR (PNG data URL) du document : même rendu que les QR existants, correction M, origine canonique. */
export function qrDocument(type: TypeDocQr, ref: string): Promise<string> {
  return QRCode.toDataURL(urlVerif(type, ref), { errorCorrectionLevel: "M", margin: 1, width: 234, color: { dark: "#1A3A6B", light: "#ffffff" } });
}
