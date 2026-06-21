import type {
  Category,
  Channel,
  EpgEntry,
  Movie,
  Season,
  Series,
  SeriesDetail,
} from '@/domain/models';
import type {
  ProviderSession,
  StreamUrlOptions,
  XtreamConfig,
} from '@/domain/provider-config';
import { decodeBase64Utf8 } from '@/lib/encoding';
import { httpJson, httpText } from '@/lib/net/http';
import type { ContentProvider } from '@/providers/ContentProvider';
import { ProviderError } from '@/providers/errors';
import type {
  XtreamAuthResponse,
  XtreamCategory,
  XtreamLiveStream,
  XtreamSeries,
  XtreamSeriesInfo,
  XtreamShortEpgResponse,
  XtreamVodStream,
} from './types';

const toNum = (v: string | number | null | undefined): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const epochOrNow = (v: string | undefined): number => {
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : Math.floor(Date.now() / 1000);
};

/**
 * Xtream Codes provider. Talks to `player_api.php` for the catalog + short EPG,
 * `xmltv.php` for the full guide, and builds the standard live/movie/series
 * playback URLs. All data is normalized into domain models before returning.
 */
export class XtreamProvider implements ContentProvider {
  readonly kind = 'xtream' as const;
  readonly profileId: string;
  private readonly base: string;
  private readonly user: string;
  private readonly pass: string;

  constructor(profileId: string, config: XtreamConfig) {
    this.profileId = profileId;
    this.base = config.baseUrl.replace(/\/+$/, '');
    this.user = config.username;
    this.pass = config.password;
  }

  private api(action?: string, params?: Record<string, string>): string {
    const url = new URL(`${this.base}/player_api.php`);
    url.searchParams.set('username', this.user);
    url.searchParams.set('password', this.pass);
    if (action) url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    return url.toString();
  }

  private id(kind: string, raw: string | number): string {
    return `${this.profileId}:${kind}:${raw}`;
  }

  async authenticate(signal?: AbortSignal): Promise<ProviderSession> {
    const res = await httpJson<XtreamAuthResponse>(this.api(), { signal });
    const info = res.user_info;
    if (!info || info.auth === 0 || info.status === 'Disabled') {
      throw new ProviderError('auth', 'Xtream account rejected the credentials');
    }
    return {
      authenticated: true,
      expiresAt: toNum(info.exp_date ?? null),
      maxConnections: toNum(info.max_connections ?? null),
      serverInfo: res.server_info
        ? Object.fromEntries(
            Object.entries(res.server_info).map(([k, v]) => [k, String(v ?? '')]),
          )
        : null,
    };
  }

  private mapCategories(
    raw: readonly XtreamCategory[],
    kind: Category['kind'],
  ): Category[] {
    return raw.map((c, index) => ({
      id: this.id(`cat-${kind}`, c.category_id),
      profileId: this.profileId,
      kind,
      name: c.category_name,
      order: index,
      isHidden: false,
      isLocked: false,
      isPinned: false,
    }));
  }

  async getLiveCategories(signal?: AbortSignal): Promise<Category[]> {
    const raw = await httpJson<XtreamCategory[]>(this.api('get_live_categories'), {
      signal,
    });
    return this.mapCategories(raw, 'live');
  }

  async getLiveChannels(signal?: AbortSignal): Promise<Channel[]> {
    const raw = await httpJson<XtreamLiveStream[]>(this.api('get_live_streams'), {
      signal,
    });
    return raw.map((s) => ({
      id: this.id('live', s.stream_id),
      profileId: this.profileId,
      categoryId: s.category_id ? this.id('cat-live', s.category_id) : null,
      name: s.name,
      streamId: String(s.stream_id),
      logoUrl: s.stream_icon || null,
      epgChannelId: s.epg_channel_id || null,
      number: toNum(s.num ?? null),
      isAdult: s.is_adult === '1' || s.is_adult === 1,
      addedAt: epochOrNow(s.added),
    }));
  }

  async getVodCategories(signal?: AbortSignal): Promise<Category[]> {
    const raw = await httpJson<XtreamCategory[]>(this.api('get_vod_categories'), {
      signal,
    });
    return this.mapCategories(raw, 'movie');
  }

  async getVod(signal?: AbortSignal): Promise<Movie[]> {
    const raw = await httpJson<XtreamVodStream[]>(this.api('get_vod_streams'), {
      signal,
    });
    return raw.map((s) => ({
      id: this.id('movie', s.stream_id),
      profileId: this.profileId,
      categoryId: s.category_id ? this.id('cat-movie', s.category_id) : null,
      name: s.name,
      streamId: String(s.stream_id),
      posterUrl: s.stream_icon || null,
      rating: toNum(s.rating ?? null),
      year: toNum(s.year ?? null),
      containerExt: s.container_extension || null,
      tmdbId: s.tmdb != null ? String(s.tmdb) : null,
      isAdult: false,
      addedAt: epochOrNow(s.added),
    }));
  }

  async getSeriesCategories(signal?: AbortSignal): Promise<Category[]> {
    const raw = await httpJson<XtreamCategory[]>(this.api('get_series_categories'), {
      signal,
    });
    return this.mapCategories(raw, 'series');
  }

  async getSeries(signal?: AbortSignal): Promise<Series[]> {
    const raw = await httpJson<XtreamSeries[]>(this.api('get_series'), { signal });
    return raw.map((s) => ({
      id: this.id('series', s.series_id),
      profileId: this.profileId,
      categoryId: s.category_id ? this.id('cat-series', s.category_id) : null,
      name: s.name,
      seriesId: String(s.series_id),
      posterUrl: s.cover || null,
      rating: toNum(s.rating ?? null),
      year: toNum(s.year ?? null),
      tmdbId: s.tmdb != null ? String(s.tmdb) : null,
      isAdult: false,
      addedAt: s.last_modified ? epochOrNow(s.last_modified) : Math.floor(Date.now() / 1000),
    }));
  }

  async getSeriesInfo(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail> {
    const res = await httpJson<XtreamSeriesInfo>(
      this.api('get_series_info', { series_id: seriesId }),
      { signal },
    );
    const seasons: Season[] = Object.entries(res.episodes ?? {})
      .map(([seasonNum, eps]) => ({
        season: Number.parseInt(seasonNum, 10) || 0,
        episodes: eps.map((e) => ({
          id: this.id('episode', e.id),
          seriesId,
          season: Number.parseInt(seasonNum, 10) || 0,
          episode: e.episode_num,
          title: e.title,
          streamId: String(e.id),
          containerExt: e.container_extension || null,
          durationSecs: e.info?.duration_secs ?? null,
          plot: e.info?.plot ?? null,
        })),
      }))
      .sort((a, b) => a.season - b.season);

    return {
      series: {
        id: this.id('series', seriesId),
        profileId: this.profileId,
        categoryId: null,
        name: '',
        seriesId,
        posterUrl: null,
        rating: null,
        year: null,
        tmdbId: null,
        isAdult: false,
        addedAt: Math.floor(Date.now() / 1000),
      },
      plot: res.info?.plot ?? null,
      cast: res.info?.cast ?? null,
      seasons,
    };
  }

  async getShortEpg(epgChannelId: string, signal?: AbortSignal): Promise<EpgEntry[]> {
    // get_short_epg keys on stream_id, not the epg id; callers pass the stream id.
    const res = await httpJson<XtreamShortEpgResponse>(
      this.api('get_short_epg', { stream_id: epgChannelId, limit: '12' }),
      { signal },
    );
    return (res.epg_listings ?? []).map((e, index) => ({
      id: this.id('epg', `${epgChannelId}-${e.id ?? index}`),
      profileId: this.profileId,
      epgChannelId,
      title: e.title ? decodeBase64Utf8(e.title) : '',
      description: e.description ? decodeBase64Utf8(e.description) : null,
      start: toNum(e.start_timestamp ?? null) ?? 0,
      end: toNum(e.stop_timestamp ?? null) ?? 0,
    }));
  }

  async getFullEpgXmltv(signal?: AbortSignal): Promise<string | null> {
    const url = new URL(`${this.base}/xmltv.php`);
    url.searchParams.set('username', this.user);
    url.searchParams.set('password', this.pass);
    try {
      return await httpText(url.toString(), { signal, timeoutMs: 60_000 });
    } catch {
      // EPG is optional; a missing/oversized guide must not fail the import.
      return null;
    }
  }

  buildLiveUrl(streamId: string, options?: StreamUrlOptions): string {
    if (options?.catchup) {
      const { start, durationMin } = options.catchup;
      const ts = new Date(start * 1000)
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 12)
        .replace(/(\d{8})(\d{4})/, '$1:$2'); // YYYYMMDD:HHMM (provider format varies)
      return `${this.base}/streaming/timeshift.php?username=${encodeURIComponent(
        this.user,
      )}&password=${encodeURIComponent(
        this.pass,
      )}&stream=${streamId}&start=${ts}&duration=${durationMin}`;
    }
    return `${this.base}/live/${encodeURIComponent(this.user)}/${encodeURIComponent(
      this.pass,
    )}/${streamId}.m3u8`;
  }

  buildMovieUrl(streamId: string, containerExt: string | null): string {
    const ext = containerExt || 'mp4';
    return `${this.base}/movie/${encodeURIComponent(this.user)}/${encodeURIComponent(
      this.pass,
    )}/${streamId}.${ext}`;
  }

  buildEpisodeUrl(streamId: string, containerExt: string | null): string {
    const ext = containerExt || 'mp4';
    return `${this.base}/series/${encodeURIComponent(this.user)}/${encodeURIComponent(
      this.pass,
    )}/${streamId}.${ext}`;
  }
}
