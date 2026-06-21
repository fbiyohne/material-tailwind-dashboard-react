import { and, desc, eq, gt, ne } from 'drizzle-orm';
import type { StreamKind } from '@/domain/models';
import { getDb } from '../db';
import { playbackProgress } from '../schema';

/**
 * Playback progress: powers resume (movies/episodes) and recents (channels).
 * Keyed by profile + item, one row per item, updated as playback advances.
 */

const progId = (profileId: string, itemId: string) => `${profileId}::${itemId}`;
const now = () => Math.floor(Date.now() / 1000);

/** Treat an item as finished past this fraction (hide from continue-watching). */
const FINISHED_RATIO = 0.95;

export interface ProgressRow {
  readonly itemId: string;
  readonly kind: StreamKind;
  readonly positionSecs: number;
  readonly durationSecs: number | null;
  readonly updatedAt: number;
}

export async function saveProgress(input: {
  profileId: string;
  itemId: string;
  kind: StreamKind;
  positionSecs: number;
  durationSecs?: number | null;
}): Promise<void> {
  const { profileId, itemId, kind, positionSecs, durationSecs = null } = input;
  await getDb()
    .insert(playbackProgress)
    .values({
      id: progId(profileId, itemId),
      profileId,
      itemId,
      kind,
      positionSecs: Math.floor(positionSecs),
      durationSecs: durationSecs != null ? Math.floor(durationSecs) : null,
      updatedAt: now(),
    })
    .onConflictDoUpdate({
      target: playbackProgress.id,
      set: {
        positionSecs: Math.floor(positionSecs),
        durationSecs: durationSecs != null ? Math.floor(durationSecs) : null,
        updatedAt: now(),
      },
    });
}

export async function getProgress(
  profileId: string,
  itemId: string,
): Promise<ProgressRow | null> {
  const rows = await getDb()
    .select()
    .from(playbackProgress)
    .where(eq(playbackProgress.id, progId(profileId, itemId)))
    .limit(1);
  const row = rows[0];
  return row
    ? {
        itemId: row.itemId,
        kind: row.kind,
        positionSecs: row.positionSecs,
        durationSecs: row.durationSecs,
        updatedAt: row.updatedAt,
      }
    : null;
}

/** Movies/episodes in progress (not finished), newest first. */
export async function getContinueWatching(
  profileId: string,
  limit = 20,
): Promise<ProgressRow[]> {
  const rows = await getDb()
    .select()
    .from(playbackProgress)
    .where(
      and(
        eq(playbackProgress.profileId, profileId),
        ne(playbackProgress.kind, 'live'),
        gt(playbackProgress.positionSecs, 0),
      ),
    )
    .orderBy(desc(playbackProgress.updatedAt))
    .limit(limit * 2);
  return (rows as ProgressRow[])
    .filter((r) => !r.durationSecs || r.positionSecs < r.durationSecs * FINISHED_RATIO)
    .slice(0, limit);
}

/** Most recently watched live channels (item ids), newest first. */
export async function getRecentChannelIds(
  profileId: string,
  limit = 15,
): Promise<string[]> {
  const rows = await getDb()
    .select({ itemId: playbackProgress.itemId })
    .from(playbackProgress)
    .where(
      and(eq(playbackProgress.profileId, profileId), eq(playbackProgress.kind, 'live')),
    )
    .orderBy(desc(playbackProgress.updatedAt))
    .limit(limit);
  return rows.map((r) => r.itemId);
}

export interface ProgressRecord {
  id: string;
  profileId: string;
  itemId: string;
  kind: StreamKind;
  positionSecs: number;
  durationSecs: number | null;
  updatedAt: number;
}

/** Export all progress (for cloud snapshot). */
export async function exportAll(): Promise<ProgressRecord[]> {
  return (await getDb().select().from(playbackProgress)) as ProgressRecord[];
}

/**
 * Import progress from a snapshot, keeping the newer record per item so a fresh
 * watch on this device isn't clobbered by an older backup.
 */
export async function importMany(rows: readonly ProgressRecord[]): Promise<void> {
  for (const r of rows) {
    const existing = await getDb()
      .select({ updatedAt: playbackProgress.updatedAt })
      .from(playbackProgress)
      .where(eq(playbackProgress.id, r.id))
      .limit(1);
    if (existing[0] && existing[0].updatedAt >= r.updatedAt) continue;
    await getDb()
      .insert(playbackProgress)
      .values(r)
      .onConflictDoUpdate({
        target: playbackProgress.id,
        set: {
          positionSecs: r.positionSecs,
          durationSecs: r.durationSecs,
          updatedAt: r.updatedAt,
        },
      });
  }
}

export async function removeProgress(profileId: string, itemId: string): Promise<void> {
  await getDb()
    .delete(playbackProgress)
    .where(eq(playbackProgress.id, progId(profileId, itemId)));
}
