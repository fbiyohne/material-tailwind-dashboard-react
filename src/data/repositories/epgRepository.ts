import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';
import type { EpgEntry } from '@/domain/models';
import { getDb } from '../db';
import { epg } from '../schema';

export interface NowNext {
  readonly now: EpgEntry | null;
  readonly next: EpgEntry | null;
}

/** Now/next programme for a channel at the given time (epoch seconds). */
export async function getNowNext(
  profileId: string,
  epgChannelId: string,
  at: number = Math.floor(Date.now() / 1000),
): Promise<NowNext> {
  const upcoming = await getDb()
    .select()
    .from(epg)
    .where(
      and(
        eq(epg.profileId, profileId),
        eq(epg.epgChannelId, epgChannelId),
        gte(epg.end, at),
      ),
    )
    .orderBy(asc(epg.start))
    .limit(2);

  const rows = upcoming as EpgEntry[];
  const now = rows.find((e) => e.start <= at && e.end > at) ?? null;
  const next = rows.find((e) => e.start > at) ?? null;
  return { now, next };
}

/**
 * All programmes overlapping [from, to) for a profile, ordered by start.
 * One query feeds the whole EPG grid; the screen groups by epgChannelId in JS.
 */
export async function getProgrammesInWindow(
  profileId: string,
  from: number,
  to: number,
): Promise<EpgEntry[]> {
  const rows = await getDb()
    .select()
    .from(epg)
    .where(and(eq(epg.profileId, profileId), lt(epg.start, to), gt(epg.end, from)))
    .orderBy(asc(epg.start));
  return rows as EpgEntry[];
}

/** Full guide window for a channel (used by the V1 EPG grid). */
export async function getGuideForChannel(
  profileId: string,
  epgChannelId: string,
  from: number,
): Promise<EpgEntry[]> {
  const rows = await getDb()
    .select()
    .from(epg)
    .where(
      and(
        eq(epg.profileId, profileId),
        eq(epg.epgChannelId, epgChannelId),
        gte(epg.end, from),
      ),
    )
    .orderBy(asc(epg.start));
  return rows as EpgEntry[];
}
