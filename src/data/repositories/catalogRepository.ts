import { and, asc, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { Scalar } from '@op-engineering/op-sqlite';
import type {
  Category,
  Channel,
  EpgEntry,
  Episode,
  Movie,
  Series,
  StreamKind,
} from '@/domain/models';
import { getDb, getRawDb } from '../db';
import { categories, channels, episodes, movies, series } from '../schema';

const b = (v: boolean): number => (v ? 1 : 0);
const CHUNK = 1000;

/** Run one INSERT statement over many param-sets, chunked, in transactions. */
async function batchInsert(statement: string, rows: Scalar[][]): Promise<void> {
  if (rows.length === 0) return;
  const db = getRawDb();
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.executeBatch([[statement, rows.slice(i, i + CHUNK)]]);
  }
}

// --- Writes (bulk, raw for speed) ------------------------------------------

export async function replaceCategories(
  profileId: string,
  kind: StreamKind,
  items: readonly Category[],
): Promise<void> {
  const db = getRawDb();
  // Preserve user curation (pin/hide/lock/order) across re-imports — category
  // ids are deterministic, so we re-apply prior flags to matching ids.
  const prior = new Map(
    (
      await getDb()
        .select({
          id: categories.id,
          isHidden: categories.isHidden,
          isLocked: categories.isLocked,
          isPinned: categories.isPinned,
          sortOrder: categories.sortOrder,
        })
        .from(categories)
        .where(and(eq(categories.profileId, profileId), eq(categories.kind, kind)))
    ).map((r) => [r.id, r] as const),
  );

  await db.execute(`DELETE FROM categories WHERE profile_id = ? AND kind = ?;`, [
    profileId,
    kind,
  ]);
  await batchInsert(
    `INSERT OR REPLACE INTO categories
       (id, profile_id, kind, name, sort_order, is_hidden, is_locked, is_pinned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    items.map((c) => {
      const kept = prior.get(c.id);
      return [
        c.id,
        c.profileId,
        c.kind,
        c.name,
        kept ? kept.sortOrder : c.order,
        b(kept ? kept.isHidden : c.isHidden),
        b(kept ? kept.isLocked : c.isLocked),
        b(kept ? kept.isPinned : c.isPinned),
      ];
    }),
  );
}

export async function replaceChannels(
  profileId: string,
  items: readonly Channel[],
): Promise<void> {
  await getRawDb().execute(`DELETE FROM channels WHERE profile_id = ?;`, [profileId]);
  await batchInsert(
    `INSERT OR REPLACE INTO channels
       (id, profile_id, category_id, name, stream_id, logo_url, epg_channel_id, number, is_adult, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    items.map((c) => [
      c.id,
      c.profileId,
      c.categoryId,
      c.name,
      c.streamId,
      c.logoUrl,
      c.epgChannelId,
      c.number,
      b(c.isAdult),
      c.addedAt,
    ]),
  );
}

export async function replaceMovies(
  profileId: string,
  items: readonly Movie[],
): Promise<void> {
  await getRawDb().execute(`DELETE FROM movies WHERE profile_id = ?;`, [profileId]);
  await batchInsert(
    `INSERT OR REPLACE INTO movies
       (id, profile_id, category_id, name, stream_id, poster_url, rating, year, container_ext, tmdb_id, is_adult, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    items.map((m) => [
      m.id,
      m.profileId,
      m.categoryId,
      m.name,
      m.streamId,
      m.posterUrl,
      m.rating,
      m.year,
      m.containerExt,
      m.tmdbId,
      b(m.isAdult),
      m.addedAt,
    ]),
  );
}

export async function replaceSeries(
  profileId: string,
  items: readonly Series[],
): Promise<void> {
  await getRawDb().execute(`DELETE FROM series WHERE profile_id = ?;`, [profileId]);
  await batchInsert(
    `INSERT OR REPLACE INTO series
       (id, profile_id, category_id, name, series_id, poster_url, rating, year, tmdb_id, is_adult, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    items.map((s) => [
      s.id,
      s.profileId,
      s.categoryId,
      s.name,
      s.seriesId,
      s.posterUrl,
      s.rating,
      s.year,
      s.tmdbId,
      b(s.isAdult),
      s.addedAt,
    ]),
  );
}

export async function upsertEpisodes(items: readonly Episode[]): Promise<void> {
  await batchInsert(
    `INSERT OR REPLACE INTO episodes
       (id, series_id, season, episode, title, stream_id, container_ext, duration_secs, plot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    items.map((e) => [
      e.id,
      e.seriesId,
      e.season,
      e.episode,
      e.title,
      e.streamId,
      e.containerExt,
      e.durationSecs,
      e.plot,
    ]),
  );
}

export async function replaceEpg(
  profileId: string,
  items: readonly EpgEntry[],
): Promise<void> {
  await getRawDb().execute(`DELETE FROM epg WHERE profile_id = ?;`, [profileId]);
  await batchInsert(
    `INSERT OR REPLACE INTO epg
       (id, profile_id, epg_channel_id, title, description, start, end)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    items.map((e) => [
      e.id,
      e.profileId,
      e.epgChannelId,
      e.title,
      e.description,
      e.start,
      e.end,
    ]),
  );
}

/**
 * Rebuild the FTS5 search index for a profile straight from SQL — no JS loop,
 * so even 50k rows index in milliseconds.
 */
export async function rebuildSearchIndex(profileId: string): Promise<void> {
  const db = getRawDb();
  await db.execute(`DELETE FROM search_index WHERE profile_id = ?;`, [profileId]);
  await db.execute(
    `INSERT INTO search_index (name, profile_id, kind, ref_id)
       SELECT name, profile_id, 'live', id FROM channels WHERE profile_id = ?;`,
    [profileId],
  );
  await db.execute(
    `INSERT INTO search_index (name, profile_id, kind, ref_id)
       SELECT name, profile_id, 'movie', id FROM movies WHERE profile_id = ?;`,
    [profileId],
  );
  await db.execute(
    `INSERT INTO search_index (name, profile_id, kind, ref_id)
       SELECT name, profile_id, 'series', id FROM series WHERE profile_id = ?;`,
    [profileId],
  );
}

// --- Reads (typed, via Drizzle) --------------------------------------------

export async function getCategories(
  profileId: string,
  kind: StreamKind,
  options: { includeHidden?: boolean } = {},
): Promise<Category[]> {
  const conditions: SQL[] = [eq(categories.profileId, profileId), eq(categories.kind, kind)];
  if (!options.includeHidden) conditions.push(eq(categories.isHidden, false));
  const rows = await getDb()
    .select()
    .from(categories)
    .where(and(...conditions))
    // Pinned first, then the curated order.
    .orderBy(desc(categories.isPinned), asc(categories.sortOrder), asc(categories.name));
  return rows.map((r) => ({ ...r, order: r.sortOrder })) as unknown as Category[];
}

export async function getChannels(
  profileId: string,
  categoryId?: string,
  includeAdult = false,
): Promise<Channel[]> {
  const conditions: SQL[] = [eq(channels.profileId, profileId)];
  if (categoryId === null) conditions.push(isNull(channels.categoryId));
  else if (categoryId !== undefined) conditions.push(eq(channels.categoryId, categoryId));
  if (!includeAdult) conditions.push(eq(channels.isAdult, false));
  const rows = await getDb()
    .select()
    .from(channels)
    .where(and(...conditions))
    .orderBy(asc(channels.name));
  return rows as Channel[];
}

export async function getMovies(
  profileId: string,
  categoryId?: string,
  includeAdult = false,
): Promise<Movie[]> {
  const conditions: SQL[] = [eq(movies.profileId, profileId)];
  if (categoryId !== undefined) conditions.push(eq(movies.categoryId, categoryId));
  if (!includeAdult) conditions.push(eq(movies.isAdult, false));
  const rows = await getDb()
    .select()
    .from(movies)
    .where(and(...conditions))
    .orderBy(asc(movies.name));
  return rows as Movie[];
}

export async function getSeries(
  profileId: string,
  categoryId?: string,
  includeAdult = false,
): Promise<Series[]> {
  const conditions: SQL[] = [eq(series.profileId, profileId)];
  if (categoryId !== undefined) conditions.push(eq(series.categoryId, categoryId));
  if (!includeAdult) conditions.push(eq(series.isAdult, false));
  const rows = await getDb()
    .select()
    .from(series)
    .where(and(...conditions))
    .orderBy(asc(series.name));
  return rows as Series[];
}

/** Update a category's curation flags / order (pin, hide, lock, reorder). */
export async function updateCategoryCuration(
  id: string,
  patch: Partial<{
    isHidden: boolean;
    isLocked: boolean;
    isPinned: boolean;
    sortOrder: number;
  }>,
): Promise<void> {
  await getDb().update(categories).set(patch).where(eq(categories.id, id));
}

export async function getChannelById(id: string): Promise<Channel | null> {
  const rows = await getDb().select().from(channels).where(eq(channels.id, id)).limit(1);
  return (rows[0] as Channel | undefined) ?? null;
}

export async function getMovieById(id: string): Promise<Movie | null> {
  const rows = await getDb().select().from(movies).where(eq(movies.id, id)).limit(1);
  return (rows[0] as Movie | undefined) ?? null;
}

export async function getSeriesById(id: string): Promise<Series | null> {
  const rows = await getDb().select().from(series).where(eq(series.id, id)).limit(1);
  return (rows[0] as Series | undefined) ?? null;
}

export async function getEpisodeById(id: string): Promise<Episode | null> {
  const rows = await getDb().select().from(episodes).where(eq(episodes.id, id)).limit(1);
  return (rows[0] as Episode | undefined) ?? null;
}

export async function getEpisodesForSeries(seriesId: string): Promise<Episode[]> {
  const rows = await getDb()
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))
    .orderBy(asc(episodes.season), asc(episodes.episode));
  return rows as Episode[];
}
