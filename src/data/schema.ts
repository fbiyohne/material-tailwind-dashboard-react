import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (Drizzle). One database holds every profile's catalog; rows are
 * scoped by `profileId` so switching providers is a query filter, not a reload —
 * the catalog is already on disk (perf requirement: near-instant profile swap).
 *
 * FTS5 (the global search index) is created separately in db.ts via raw SQL,
 * because Drizzle's schema DSL doesn't model virtual tables.
 */

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['xtream', 'm3u'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at').notNull(),
  lastSyncedAt: integer('last_synced_at'),
});

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    kind: text('kind', { enum: ['live', 'movie', 'series'] }).notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false),
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [index('idx_categories_profile_kind').on(t.profileId, t.kind)],
);

export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    streamId: text('stream_id').notNull(),
    logoUrl: text('logo_url'),
    epgChannelId: text('epg_channel_id'),
    number: integer('number'),
    isAdult: integer('is_adult', { mode: 'boolean' }).notNull().default(false),
    catchupDays: integer('catchup_days'),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [
    index('idx_channels_profile_cat').on(t.profileId, t.categoryId),
    index('idx_channels_epg').on(t.profileId, t.epgChannelId),
  ],
);

export const movies = sqliteTable(
  'movies',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    streamId: text('stream_id').notNull(),
    posterUrl: text('poster_url'),
    rating: real('rating'),
    year: integer('year'),
    containerExt: text('container_ext'),
    tmdbId: text('tmdb_id'),
    isAdult: integer('is_adult', { mode: 'boolean' }).notNull().default(false),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [index('idx_movies_profile_cat').on(t.profileId, t.categoryId)],
);

export const series = sqliteTable(
  'series',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    seriesId: text('series_id').notNull(),
    posterUrl: text('poster_url'),
    rating: real('rating'),
    year: integer('year'),
    tmdbId: text('tmdb_id'),
    isAdult: integer('is_adult', { mode: 'boolean' }).notNull().default(false),
    addedAt: integer('added_at').notNull(),
  },
  (t) => [index('idx_series_profile_cat').on(t.profileId, t.categoryId)],
);

export const episodes = sqliteTable(
  'episodes',
  {
    id: text('id').primaryKey(),
    seriesId: text('series_id').notNull(),
    season: integer('season').notNull(),
    episode: integer('episode').notNull(),
    title: text('title').notNull(),
    streamId: text('stream_id').notNull(),
    containerExt: text('container_ext'),
    durationSecs: integer('duration_secs'),
    plot: text('plot'),
  },
  (t) => [index('idx_episodes_series').on(t.seriesId)],
);

export const epg = sqliteTable(
  'epg',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    epgChannelId: text('epg_channel_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    start: integer('start').notNull(),
    end: integer('end').notNull(),
  },
  (t) => [index('idx_epg_lookup').on(t.profileId, t.epgChannelId, t.start)],
);

export const favorites = sqliteTable(
  'favorites',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    itemId: text('item_id').notNull(),
    kind: text('kind', { enum: ['live', 'movie', 'series'] }).notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('idx_favorites_profile').on(t.profileId, t.kind)],
);

export const playbackProgress = sqliteTable(
  'playback_progress',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id').notNull(),
    itemId: text('item_id').notNull(),
    kind: text('kind', { enum: ['live', 'movie', 'series'] }).notNull(),
    positionSecs: integer('position_secs').notNull().default(0),
    durationSecs: integer('duration_secs'),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('idx_progress_profile').on(t.profileId, t.updatedAt)],
);

/** Schema constant exposed for `migrate()` / typed query building. */
export const schema = {
  profiles,
  categories,
  channels,
  movies,
  series,
  episodes,
  epg,
  favorites,
  playbackProgress,
};

/** Raw SQL for the FTS5 virtual table backing global search. */
export const FTS5_SETUP = sql`
  CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    name,
    profile_id UNINDEXED,
    kind UNINDEXED,
    ref_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  );
`;
