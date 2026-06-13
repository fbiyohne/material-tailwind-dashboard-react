import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Signature électronique des documents officiels — signature **asymétrique
 * RSA-2048 / SHA-256** (clé privée du Barreau, clé publique distribuable).
 * Il s'agit d'une signature électronique « avancée » : pour le niveau
 * **qualifié (eIDAS)**, remplacer la clé par un certificat délivré par un
 * prestataire de services de confiance qualifié (QTSP) sur un QSCD.
 */
const keyDir = process.env.SIGNATURE_KEY_DIR || path.resolve("secrets");
const privPath = path.join(keyDir, "signing-private.pem");
const pubPath = path.join(keyDir, "signing-public.pem");

function chargerCles(): { privateKey: string; publicKey: string } {
  if (process.env.SIGNATURE_PRIVATE_KEY && process.env.SIGNATURE_PUBLIC_KEY) {
    return { privateKey: process.env.SIGNATURE_PRIVATE_KEY, publicKey: process.env.SIGNATURE_PUBLIC_KEY };
  }
  try {
    if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
      return { privateKey: fs.readFileSync(privPath, "utf8"), publicKey: fs.readFileSync(pubPath, "utf8") };
    }
  } catch {
    /* ignore */
  }
  // Génération (développement) et persistance.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  try {
    fs.mkdirSync(keyDir, { recursive: true });
    fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(pubPath, publicKey);
  } catch {
    /* lecture seule : on garde les clés en mémoire */
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
