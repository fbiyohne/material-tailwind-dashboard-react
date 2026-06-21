import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle, type OPSQLiteDatabase } from 'drizzle-orm/op-sqlite';
import { schema } from './schema';

/**
 * Database bootstrap.
 *
 * op-sqlite is the raw JSI connection (fast bulk inserts + FTS5); Drizzle wraps
 * the same handle to give typed queries to the repositories. We keep both: ORM
 * for ergonomics, raw access for the hot paths (50k-row imports, FTS search).
 *
 * The DDL lives here as idempotent raw SQL rather than generated migrations so
 * the socle has zero build-time codegen; once the schema stabilizes this can be
 * swapped for drizzle-kit migrations without touching repository code.
 */

const DB_NAME = 'creatic.db';

let rawDb: DB | null = null;
let ormDb: OPSQLiteDatabase<typeof schema> | null = null;

export function getRawDb(): DB {
  if (!rawDb) rawDb = open({ name: DB_NAME });
  return rawDb;
}

export function getDb(): OPSQLiteDatabase<typeof schema> {
  if (!ormDb) ormDb = drizzle(getRawDb(), { schema });
  return ormDb;
}

const DDL = [
  `PRAGMA journal_mode = WAL;`,
  `PRAGMA synchronous = NORMAL;`,
  `PRAGMA foreign_keys = ON;`,
  `PRAGMA temp_store = MEMORY;`,

  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    last_synced_at INTEGER
  );`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    is_locked INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_categories_profile_kind ON categories (profile_id, kind);`,

  `CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    logo_url TEXT,
    epg_channel_id TEXT,
    number INTEGER,
    is_adult INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_channels_profile_cat ON channels (profile_id, category_id);`,
  `CREATE INDEX IF NOT EXISTS idx_channels_epg ON channels (profile_id, epg_channel_id);`,

  `CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    poster_url TEXT,
    rating REAL,
    year INTEGER,
    container_ext TEXT,
    tmdb_id TEXT,
    is_adult INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_movies_profile_cat ON movies (profile_id, category_id);`,

  `CREATE TABLE IF NOT EXISTS series (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    series_id TEXT NOT NULL,
    poster_url TEXT,
    rating REAL,
    year INTEGER,
    tmdb_id TEXT,
    is_adult INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_series_profile_cat ON series (profile_id, category_id);`,

  `CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    series_id TEXT NOT NULL,
    season INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    title TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    container_ext TEXT,
    duration_secs INTEGER,
    plot TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_episodes_series ON episodes (series_id);`,

  `CREATE TABLE IF NOT EXISTS epg (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    epg_channel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_epg_lookup ON epg (profile_id, epg_channel_id, start);`,

  `CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_favorites_profile ON favorites (profile_id, kind);`,

  `CREATE TABLE IF NOT EXISTS playback_progress (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    position_secs INTEGER NOT NULL DEFAULT 0,
    duration_secs INTEGER,
    updated_at INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_progress_profile ON playback_progress (profile_id, updated_at);`,

  `CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
    name,
    profile_id UNINDEXED,
    kind UNINDEXED,
    ref_id UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
  );`,
];

let migrated = false;

/** Create tables, indexes and the FTS5 virtual table. Idempotent. */
export async function runMigrations(): Promise<void> {
  if (migrated) return;
  const db = getRawDb();
  for (const statement of DDL) {
    await db.execute(statement);
  }
  migrated = true;
}

/** Test/maintenance helper: wipe every row for a profile (cascade by hand). */
export async function deleteProfileData(profileId: string): Promise<void> {
  const db = getRawDb();
  const tables = [
    'categories',
    'channels',
    'movies',
    'series',
    'epg',
    'favorites',
    'playback_progress',
  ];
  for (const t of tables) {
    await db.execute(`DELETE FROM ${t} WHERE profile_id = ?;`, [profileId]);
  }
  await db.execute(`DELETE FROM search_index WHERE profile_id = ?;`, [profileId]);
  await db.execute(
    `DELETE FROM episodes WHERE series_id IN (SELECT series_id FROM series WHERE profile_id = ?);`,
    [profileId],
  );
}
