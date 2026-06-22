import type { StreamKind } from '@/domain/models';

/**
 * On-device natural-language query parser (FR + EN), no backend, no LLM.
 *
 * Turns phrases like « les matchs de foot ce soir » or "movies tonight" into a
 * structured query: a time window, a content kind, and topic keywords. The
 * Search screen runs an EPG programme search when a time window / programme
 * intent is detected, otherwise the catalog FTS search.
 *
 * Heuristic by design — demonstrable and instant. A richer model can replace
 * this without changing the NlQuery contract.
 */

export interface NlQuery {
  readonly raw: string;
  /** Topic terms (accent-preserving) for matching, synonyms already expanded. */
  readonly keywords: string[];
  /** Time window (epoch seconds) when a temporal phrase is present. */
  readonly window: { from: number; to: number } | null;
  readonly kind: StreamKind | null;
  /** True when this should search EPG programmes rather than the catalog. */
  readonly epg: boolean;
  /** Human-readable chips describing the interpretation. */
  readonly labels: string[];
}

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const STOPWORDS = new Set(
  [
    // FR
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'd', 'l', 'à', 'a', 'au', 'aux',
    'ce', 'cet', 'cette', 'ces', 'et', 'ou', 'que', 'qu', 'quoi', 'quel', 'quelle',
    'quels', 'quelles', 'y', 'il', 'est', 'pour', 'avec', 'sur', 'me', 'montre', 'moi',
    'ya', 'passe', 'passent', 'diffuse',
    // EN
    'the', 'a', 'an', 'of', 'is', 'are', 'on', 'this', 'what', 'show', 'me', 'whats',
    'in', 'at', 'to', 'for', 'with',
  ].map(stripAccents),
);

// Temporal words removed from keyword extraction.
const TEMPORAL_WORDS = new Set(
  [
    'maintenant', 'now', 'soir', 'soiree', 'tonight', 'evening', 'matin', 'morning',
    'apres', 'midi', 'afternoon', 'demain', 'tomorrow', 'nuit', 'weekend', 'week', 'end',
    'aujourdhui', 'today', 'cet',
  ].map(stripAccents),
);

const KIND_WORDS: Record<string, StreamKind> = {
  film: 'movie', films: 'movie', movie: 'movie', movies: 'movie',
  serie: 'series', series: 'series',
  chaine: 'live', chaines: 'live', channel: 'live', channels: 'live', direct: 'live',
};

const PROGRAMME_WORDS = new Set(
  ['match', 'matchs', 'matches', 'sport', 'sports', 'foot', 'football', 'basket',
    'tennis', 'rugby', 'emission', 'emissions', 'programme', 'programmes', 'news',
    'info', 'infos', 'journal'].map(stripAccents),
);

const SYNONYMS: Record<string, string[]> = {
  foot: ['football'],
  football: ['foot'],
  cine: ['cinema'],
  actu: ['info', 'journal'],
};

function dayStart(nowSecs: number): Date {
  const d = new Date(nowSecs * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}
const toEpoch = (d: Date) => Math.floor(d.getTime() / 1000);
function at(nowSecs: number, hour: number, min = 0): number {
  const d = dayStart(nowSecs);
  d.setHours(hour, min, 0, 0);
  return toEpoch(d);
}
const DAY = 86_400;

function detectWindow(
  text: string,
  nowSecs: number,
): { window: { from: number; to: number }; label: string } | null {
  const startTomorrow = toEpoch(dayStart(nowSecs)) + DAY;
  if (/\b(maintenant|now)\b/.test(text)) {
    return { window: { from: nowSecs, to: nowSecs + 3 * 3600 }, label: 'now' };
  }
  if (/\b(ce soir|soir|tonight|this evening)\b/.test(text)) {
    return { window: { from: Math.max(nowSecs, at(nowSecs, 18)), to: startTomorrow }, label: 'tonight' };
  }
  if (/\b(cet apr[eè]s-?midi|this afternoon)\b/.test(text)) {
    return { window: { from: at(nowSecs, 12), to: at(nowSecs, 18) }, label: 'afternoon' };
  }
  if (/\b(ce matin|this morning)\b/.test(text)) {
    return { window: { from: at(nowSecs, 6), to: at(nowSecs, 12) }, label: 'morning' };
  }
  if (/\b(demain|tomorrow)\b/.test(text)) {
    return { window: { from: startTomorrow, to: startTomorrow + DAY }, label: 'tomorrow' };
  }
  if (/\b(aujourd'?hui|today)\b/.test(text)) {
    return { window: { from: nowSecs, to: startTomorrow }, label: 'today' };
  }
  return null;
}

export function parseNlQuery(raw: string, nowSecs: number = Math.floor(Date.now() / 1000)): NlQuery {
  const lower = raw.toLowerCase();
  const flat = stripAccents(lower);

  const temporal = detectWindow(lower, nowSecs);
  const window = temporal?.window ?? null;

  // Content kind + programme intent.
  let kind: StreamKind | null = null;
  let programme = false;
  const tokens = flat.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const tok of tokens) {
    if (kind === null && tok in KIND_WORDS) kind = KIND_WORDS[tok];
    if (PROGRAMME_WORDS.has(tok)) programme = true;
  }

  // Topic keywords: original (accented) tokens minus stopwords/temporal/kind.
  const rawTokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const keywords: string[] = [];
  for (const tok of rawTokens) {
    const norm = stripAccents(tok);
    if (norm.length < 2) continue;
    if (STOPWORDS.has(norm) || TEMPORAL_WORDS.has(norm)) continue;
    if (norm in KIND_WORDS) continue;
    if (!keywords.includes(tok)) keywords.push(tok);
    for (const syn of SYNONYMS[norm] ?? []) {
      if (!keywords.includes(syn)) keywords.push(syn);
    }
  }

  const epg = window !== null || programme;

  const labels: string[] = [];
  if (temporal) labels.push(temporal.label);
  if (kind) labels.push(kind);
  labels.push(...keywords);

  return { raw, keywords, window, kind, epg, labels };
}
