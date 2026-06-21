import { and, asc, eq, gt, gte, lt } from 'drizzle-orm';
import type { Scalar } from '@op-engineering/op-sqlite';
import type { EpgEntry } from '@/domain/models';
import { getDb, getRawDb } from '../db';
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

export interface ProgrammeHit {
  readonly channelId: string;
  readonly channelName: string;
  readonly streamId: string;
  readonly logoUrl: string | null;
  readonly title: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Natural-language EPG search: programmes in a window whose title/description
 * match any keyword, joined to their channel so the result is directly
 * playable. Keyword matching is OR (recall-oriented) for NL queries.
 */
export async function searchProgrammes(
  profileId: string,
  keywords: readonly string[],
  from: number,
  to: number,
  limit = 100,
): Promise<ProgrammeHit[]> {
  const params: Scalar[] = [profileId, to, from];
  let keywordClause = '';
  if (keywords.length > 0) {
    const ors = keywords
      .map(() => `(lower(e.title) LIKE ? OR lower(e.description) LIKE ?)`)
      .join(' OR ');
    keywordClause = `AND (${ors})`;
    for (const kw of keywords) {
      const like = `%${kw.toLowerCase()}%`;
      params.push(like, like);
    }
  }
  params.push(limit);

  const res = await getRawDb().execute(
    `SELECT e.epg_channel_id AS epgChannelId, e.title AS title, e.start AS start, e.end AS end,
            c.id AS channelId, c.name AS channelName, c.stream_id AS streamId, c.logo_url AS logoUrl
       FROM epg e
       JOIN channels c
         ON c.profile_id = e.profile_id AND c.epg_channel_id = e.epg_channel_id
      WHERE e.profile_id = ? AND e.start < ? AND e.end > ?
      ${keywordClause}
      ORDER BY e.start
      LIMIT ?;`,
    params,
  );
  return (res.rows ?? []) as unknown as ProgrammeHit[];
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
