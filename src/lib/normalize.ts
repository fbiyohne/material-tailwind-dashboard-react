/**
 * Name normalization + quality ranking for catalog sanitation.
 *
 * Providers ship the same channel many times (different qualities/sources).
 * We collapse them by a normalized key and keep the best-quality variant.
 */

const QUALITY_TOKENS =
  /\b(4k|uhd|fhd|hd|sd|hevc|h\.?265|h\.?264|2160p?|1080p?|720p?|480p?|raw|backup|multi|vip)\b/gi;

/** Lowercased, accent/quality/bracket-stripped key for grouping duplicates. */
export function normalizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // strip [..] and (..)
    .replace(QUALITY_TOKENS, ' ')
    .replace(/[^a-z0-9]+/g, ' ') // keep alphanumerics only
    .trim()
    .replace(/\s+/g, ' ');
}

/** Higher is better. Used to pick the variant to keep within a duplicate group. */
export function qualityRank(name: string): number {
  const n = name.toLowerCase();
  if (/\b(4k|uhd|2160)/.test(n)) return 4;
  if (/\b(fhd|1080)/.test(n)) return 3;
  if (/\b(hd|720)/.test(n)) return 2;
  if (/\b(sd|480)/.test(n)) return 1;
  return 0;
}

/** Strip a leading year and trailing junk from a VOD title for TMDB search. */
export function cleanTitleForSearch(name: string): string {
  return name
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
    .replace(QUALITY_TOKENS, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ') // year handled separately
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract a 4-digit year from a title if present. */
export function extractYear(name: string): number | null {
  const m = /\b(19\d{2}|20\d{2})\b/.exec(name);
  return m ? Number.parseInt(m[1], 10) : null;
}
