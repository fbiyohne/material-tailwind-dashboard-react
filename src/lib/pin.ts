import * as Crypto from 'expo-crypto';

/**
 * Hash a parental PIN before storing it. The PIN is never kept in clear text;
 * only this hash lives in the (already encrypted) settings store. Local-only
 * threat model, so a salted SHA-256 is sufficient.
 */
export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `creatic-parental:${pin}`,
  );
}
