import crypto from "node:crypto";
import { env } from "../env.js";

/**
 * Signature électronique des documents officiels — sceau cryptographique
 * HMAC-SHA256 (déterministe, vérifiable). Fondation d'une e-signature ; en
 * production, à compléter par une PKI / certificat qualifié (eIDAS).
 */
const secret = process.env.SIGNATURE_SECRET || env.jwtSecret;

export function signerDocument(payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifierDocument(payload: string, signature: string): boolean {
  try {
    const attendu = signerDocument(payload);
    return crypto.timingSafeEqual(Buffer.from(attendu), Buffer.from(signature));
  } catch {
    return false;
  }
}

export const quitusPayload = (q: { numero: string; membreId: number; annee: number; dateEmission: Date | string }) =>
  `QUITUS|${q.numero}|${q.membreId}|${q.annee}|${new Date(q.dateEmission).toISOString().slice(0, 10)}`;
