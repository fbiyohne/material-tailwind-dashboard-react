import type {
  Category,
  Channel,
  EpgEntry,
  Movie,
  Series,
  SeriesDetail,
} from '@/domain/models';
import type {
  ProviderConfig,
  ProviderKind,
  ProviderSession,
  StreamUrlOptions,
} from '@/domain/provider-config';

/**
 * The one interface to rule them all.
 *
 * Every concrete provider (Xtream, M3U, and any future source) implements this.
 * Screens, the sync orchestrator and repositories depend ONLY on this contract,
 * never on a concrete implementation. Adding a new provider = adding one class
 * here, with zero changes upstream.
 *
 * Implementations must:
 *  - normalize provider data into the domain models in src/domain,
 *  - be cancellable via the optional AbortSignal,
 *  - never throw raw network errors upward — wrap them in ProviderError.
 */
export interface ContentProvider {
  readonly kind: ProviderKind;
  readonly profileId: string;

  /** Verify credentials / reachability. Cheap; called on onboarding. */
  authenticate(signal?: AbortSignal): Promise<ProviderSession>;

  // --- Catalog (full fetch, used by the sync orchestrator) -----------------
  getLiveCategories(signal?: AbortSignal): Promise<Category[]>;
  getLiveChannels(signal?: AbortSignal): Promise<Channel[]>;
  getVodCategories(signal?: AbortSignal): Promise<Category[]>;
  getVod(signal?: AbortSignal): Promise<Movie[]>;
  getSeriesCategories(signal?: AbortSignal): Promise<Category[]>;
  getSeries(signal?: AbortSignal): Promise<Series[]>;

  /** Lazy per-series detail (seasons + episodes). */
  getSeriesInfo(seriesId: string, signal?: AbortSignal): Promise<SeriesDetail>;

  // --- EPG ------------------------------------------------------------------
  /** Now/next style short EPG for a single channel. */
  getShortEpg(epgChannelId: string, signal?: AbortSignal): Promise<EpgEntry[]>;

  /**
   * Full guide as an XMLTV document string. Returns null when the provider
   * exposes no EPG.
   *
   * NOTE: returns a string for now because React Native's fetch has no
   * streaming response body. The deferred optimization (download to a file via
   * expo-file-system, then chunked SAX parse) will change this return type to a
   * file URI; the importer is the only caller, so the blast radius is contained.
   */
  getFullEpgXmltv(signal?: AbortSignal): Promise<string | null>;

  // --- Playback -------------------------------------------------------------
  /** Build a playable URL for a live channel. */
  buildLiveUrl(streamId: string, options?: StreamUrlOptions): string;
  /** Build a playable URL for a movie. */
  buildMovieUrl(streamId: string, containerExt: string | null): string;
  /** Build a playable URL for an episode. */
  buildEpisodeUrl(streamId: string, containerExt: string | null): string;
}

/** Factory contract so the rest of the app never `new`s a concrete provider. */
export type ContentProviderFactory = (
  profileId: string,
  config: ProviderConfig,
) => ContentProvider;
