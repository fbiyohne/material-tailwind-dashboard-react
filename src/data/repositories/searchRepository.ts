import type { StreamKind } from '@/domain/models';
import { getRawDb } from '../db';

export interface SearchHit {
  readonly refId: string;
  readonly name: string;
  readonly kind: StreamKind;
}

/** Escape user input into a safe FTS5 prefix query (e.g. `foo bar*`). */
function toFtsQuery(input: string): string {
  const terms = input
    .trim()
    .replace(/["*]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t}"*`);
  return terms.join(' ');
}

/**
 * Global search across live/movies/series via the FTS5 index. Single indexed
 * query regardless of catalog size — the perf budget for 50k+ items.
 */
export async function searchCatalog(
  profileId: string,
  query: string,
  limit = 100,
): Promise<SearchHit[]> {
  const fts = toFtsQuery(query);
  if (!fts) return [];
  const res = await getRawDb().execute(
    `SELECT ref_id AS refId, name, kind
       FROM search_index
      WHERE profile_id = ? AND search_index MATCH ?
      ORDER BY rank
      LIMIT ?;`,
    [profileId, fts, limit],
  );
  return (res.rows ?? []) as unknown as SearchHit[];
}
