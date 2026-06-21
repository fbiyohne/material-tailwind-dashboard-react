/**
 * Domain models — the vocabulary the whole app speaks.
 *
 * These types are provider-agnostic on purpose: nothing here knows whether the
 * data came from Xtream Codes or an M3U playlist. The provider layer normalizes
 * everything into these shapes (see src/providers), and every screen consumes
 * only these. This is the technical meaning of "works with all providers".
 */

/** The three top-level content kinds an IPTV provider exposes. */
export type StreamKind = 'live' | 'movie' | 'series';

/** A grouping of streams (Xtream category, or M3U `group-title`). */
export interface Category {
  /** Stable id, unique within a profile + kind. */
  readonly id: string;
  readonly profileId: string;
  readonly kind: StreamKind;
  readonly name: string;
  /** Provider-reported ordering, when available. */
  readonly order: number;
  /** User curation flags (set on-device, never from the provider). */
  readonly isHidden: boolean;
  readonly isLocked: boolean;
  readonly isPinned: boolean;
}

/** A live TV channel. */
export interface Channel {
  readonly id: string;
  readonly profileId: string;
  readonly categoryId: string | null;
  readonly name: string;
  /** Provider stream id (Xtream) or resolved stream URL key (M3U). */
  readonly streamId: string;
  readonly logoUrl: string | null;
  /** Maps to an EPG channel id (Xtream `epg_channel_id` / M3U `tvg-id`). */
  readonly epgChannelId: string | null;
  /** LCN / channel number when the provider supplies one. */
  readonly number: number | null;
  readonly isAdult: boolean;
  /** Days of catch-up/archive available for this channel (0/null = none). */
  readonly catchupDays: number | null;
  readonly addedAt: number;
}

/** A video-on-demand movie. */
export interface Movie {
  readonly id: string;
  readonly profileId: string;
  readonly categoryId: string | null;
  readonly name: string;
  readonly streamId: string;
  readonly posterUrl: string | null;
  readonly rating: number | null;
  readonly year: number | null;
  /** File container (`mp4`, `mkv`…) needed to build the playback URL. */
  readonly containerExt: string | null;
  readonly tmdbId: string | null;
  readonly isAdult: boolean;
  readonly addedAt: number;
}

/** A series header (no episodes — those load lazily via SeriesDetail). */
export interface Series {
  readonly id: string;
  readonly profileId: string;
  readonly categoryId: string | null;
  readonly name: string;
  /** Provider series id used to fetch detail. */
  readonly seriesId: string;
  readonly posterUrl: string | null;
  readonly rating: number | null;
  readonly year: number | null;
  readonly tmdbId: string | null;
  readonly isAdult: boolean;
  readonly addedAt: number;
}

/** One episode inside a series season. */
export interface Episode {
  readonly id: string;
  readonly seriesId: string;
  readonly season: number;
  readonly episode: number;
  readonly title: string;
  readonly streamId: string;
  readonly containerExt: string | null;
  readonly durationSecs: number | null;
  readonly plot: string | null;
}

export interface Season {
  readonly season: number;
  readonly episodes: readonly Episode[];
}

/** Full series payload returned on demand. */
export interface SeriesDetail {
  readonly series: Series;
  readonly plot: string | null;
  readonly cast: string | null;
  readonly seasons: readonly Season[];
}

/** A single EPG programme entry (now/next or full guide). */
export interface EpgEntry {
  readonly id: string;
  readonly profileId: string;
  /** EPG channel id (joins to Channel.epgChannelId). */
  readonly epgChannelId: string;
  readonly title: string;
  readonly description: string | null;
  /** Unix epoch seconds, UTC. */
  readonly start: number;
  readonly end: number;
}

/** Catch-up / archive availability for a channel. */
export interface CatchupWindow {
  readonly channelId: string;
  /** Days of archive the provider retains. */
  readonly days: number;
}
