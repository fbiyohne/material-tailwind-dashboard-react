/**
 * FNV-1a 32-bit hash → short hex string.
 *
 * Synchronous and deterministic, used to derive stable ids for M3U entries
 * (which have no provider-assigned id) and dedup keys. Not cryptographic.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
