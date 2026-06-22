import type {
  Category,
  Channel,
  EpgEntry,
  Movie,
  Series,
  SeriesDetail,
} from '@/domain/models';
import type { M3uConfig, ProviderSession } from '@/domain/provider-config';
import { fnv1a } from '@/lib/hash';
import { httpText } from '@/lib/net/http';
import { parseM3u, type M3uEntry } from '@/lib/parsers/m3u';
import type { ContentProvider } from '@/providers/ContentProvider';
import { ProviderError } from '@/providers/errors';

const ADULT_RE = /\b(xxx|adult|18\+|\+18|porn)\b/i;

/**
 * M3U / M3U8 provider. One playlist fetch yields live channels grouped by
 * `group-title`; the optional XMLTV URL supplies the EPG. M3U has no structured
 * VOD/series catalog, so those return empty and per-series detail is reported as
 * unsupported — screens degrade gracefully because they only see the interface.
 */
export class M3uProvider implements ContentProvider {
  readonly kind = 'm3u' as const;
  readonly profileId: string;
  private readonly playlistUrl: string;
  private readonly epgUrl: string | null;
  private entriesCache: Promise<M3uEntry[]> | null = null;

  constructor(profileId: string, config: M3uConfig) {
    this.profileId = profileId;
    this.playlistUrl = config.playlistUrl;
    this.epgUrl = config.epgUrl;
  }

  private async entries(signal?: AbortSignal): Promise<M3uEntry[]> {
    if (!this.entriesCache) {
      this.entriesCache = httpText(this.playlistUrl, { signal, timeoutMs: 60_000 })
        .then(parseM3u)
        .catch((error) => {
          this.entriesCache = null; // allow retry
          throw ProviderError.from(error, 'network');
        });
    }
    return this.entriesCache;
  }

  private catId(name: string): string {
    return `${this.profileId}:cat-live:${fnv1a(name)}`;
  }

  async authenticate(signal?: AbortSignal): Promise<ProviderSession> {
    // No auth endpoint; success means the playlist is reachable and parses.
    const entries = await this.entries(signal);
    if (entries.length === 0) {
      throw new ProviderError('parse', 'Playlist is empty or could not be parsed');
    }
    return {
      authenticated: true,
      expiresAt: null,
      maxConnections: null,
      serverInfo: null,
    };
  }

  async getLiveCategories(signal?: AbortSignal): Promise<Category[]> {
    const entries = await this.entries(signal);
    const seen = new Map<string, number>();
    for (const e of entries) {
      const name = e.groupTitle ?? 'Ungrouped';
      if (!seen.has(name)) seen.set(name, seen.size);
    }
    return [...seen.entries()].map(([name, order]) => ({
      id: this.catId(name),
      profileId: this.profileId,
      kind: 'live' as const,
      name,
      order,
      isHidden: false,
      isLocked: false,
      isPinned: false,
    }));
  }

  async getLiveChannels(signal?: AbortSignal): Promise<Channel[]> {
    const entries = await this.entries(signal);
    const now = Math.floor(Date.now() / 1000);
    return entries.map((e) => {
      const group = e.groupTitle ?? 'Ungrouped';
      // For M3U the stream URL itself is the stable identity.
      const streamId = e.url;
      return {
        id: `${this.profileId}:live:${fnv1a(e.url)}`,
        profileId: this.profileId,
        categoryId: this.catId(group),
        name: e.name,
        streamId,
        logoUrl: e.tvgLogo,
        epgChannelId: e.tvgId,
        number: e.channelNumber,
        isAdult: ADULT_RE.test(group) || ADULT_RE.test(e.name),
        catchupDays: e.catchupDays,
        addedAt: now,
      };
    });
  }

  // M3U has no structured VOD / series catalog.
  async getVodCategories(): Promise<Category[]> {
    return [];
  }
  async getVod(): Promise<Movie[]> {
    return [];
  }
  async getSeriesCategories(): Promise<Category[]> {
    return [];
  }
  async getSeries(): Promise<Series[]> {
    return [];
  }
  async getSeriesInfo(): Promise<SeriesDetail> {
    throw new ProviderError('unsupported', 'M3U providers expose no series detail');
  }

  async getShortEpg(): Promise<EpgEntry[]> {
    // Short EPG is derived from the full XMLTV guide at sync time, not per call.
    return [];
  }

  async getFullEpgXmltv(signal?: AbortSignal): Promise<string | null> {
    if (!this.epgUrl) return null;
    try {
      return await httpText(this.epgUrl, { signal, timeoutMs: 60_000 });
    } catch {
      return null;
    }
  }

  buildLiveUrl(streamId: string): string {
    // streamId is already the playable URL.
    return streamId;
  }

  buildCatchupUrl(streamId: string, start: number, _durationMin: number): string {
    // Best-effort: most M3U/Xtream playlists accept ?utc=<start>&lutc=<now>.
    // Providers using a custom catchup-source template aren't covered here.
    const now = Math.floor(Date.now() / 1000);
    const sep = streamId.includes('?') ? '&' : '?';
    return `${streamId}${sep}utc=${start}&lutc=${now}`;
  }
  buildMovieUrl(streamId: string): string {
    return streamId;
  }
  buildEpisodeUrl(streamId: string): string {
    return streamId;
  }
}
