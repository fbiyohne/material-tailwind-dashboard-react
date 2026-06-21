import { catalogRepo } from '@/data';
import { mapWithConcurrency } from '@/lib/concurrency';
import { cleanTitleForSearch, extractYear } from '@/lib/normalize';
import { httpJson } from '@/lib/net/http';

/**
 * TMDB metadata enrichment.
 *
 * Zero backend, so the TMDB API key is the user's own (entered in Maintenance,
 * stored in the encrypted settings). We only enrich items missing a poster, in
 * bounded batches, to stay polite to the API.
 */

const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

interface TmdbSearchResponse {
  readonly results?: readonly {
    readonly id: number;
    readonly poster_path?: string | null;
    readonly vote_average?: number;
  }[];
}

interface Art {
  tmdbId: string;
  posterUrl: string;
  rating: number | null;
}

async function searchTmdb(
  kind: 'movie' | 'tv',
  apiKey: string,
  query: string,
  year: number | undefined,
  signal: AbortSignal | undefined,
): Promise<Art | null> {
  const url = new URL(`https://api.themoviedb.org/3/search/${kind}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', query);
  if (year) {
    url.searchParams.set(kind === 'movie' ? 'year' : 'first_air_date_year', String(year));
  }
  const res = await httpJson<TmdbSearchResponse>(url.toString(), { signal, retries: 1 });
  const top = res.results?.[0];
  if (!top || !top.poster_path) return null;
  return {
    tmdbId: String(top.id),
    posterUrl: `${IMG_BASE}${top.poster_path}`,
    rating: top.vote_average ?? null,
  };
}

export interface EnrichOptions {
  limit?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface EnrichResult {
  processed: number;
  enriched: number;
}

export async function enrichCatalog(
  profileId: string,
  apiKey: string,
  options: EnrichOptions = {},
): Promise<EnrichResult> {
  const { limit = 200, concurrency = 4, onProgress, signal } = options;

  const moviesNeeding = await catalogRepo.getMoviesMissingArt(profileId, limit);
  const seriesNeeding = await catalogRepo.getSeriesMissingArt(
    profileId,
    Math.max(0, limit - moviesNeeding.length),
  );

  const targets = [
    ...moviesNeeding.map((m) => ({ kind: 'movie' as const, id: m.id, name: m.name, year: m.year })),
    ...seriesNeeding.map((s) => ({ kind: 'tv' as const, id: s.id, name: s.name, year: s.year })),
  ];

  let enriched = 0;
  await mapWithConcurrency(
    targets,
    concurrency,
    async (target) => {
      const query = cleanTitleForSearch(target.name);
      if (!query) return;
      const year = target.year ?? extractYear(target.name) ?? undefined;
      try {
        const art = await searchTmdb(target.kind, apiKey, query, year, signal);
        if (!art) return;
        const patch = {
          posterUrl: art.posterUrl,
          tmdbId: art.tmdbId,
          ...(art.rating != null ? { rating: art.rating } : {}),
        };
        if (target.kind === 'movie') await catalogRepo.updateMovieArt(target.id, patch);
        else await catalogRepo.updateSeriesArt(target.id, patch);
        enriched++;
      } catch {
        // skip this title; enrichment is best-effort
      }
    },
    onProgress,
  );

  return { processed: targets.length, enriched };
}
