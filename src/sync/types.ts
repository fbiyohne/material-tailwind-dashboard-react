/** Discrete phases of a catalog import, surfaced to the progress screen. */
export type SyncPhase =
  | 'authenticating'
  | 'live'
  | 'vod'
  | 'series'
  | 'epg'
  | 'indexing'
  | 'done'
  | 'error';

export interface SyncProgress {
  readonly phase: SyncPhase;
  /** 0..1 overall completion estimate. */
  readonly progress: number;
  /** Human-readable detail (counts), already localized by the caller. */
  readonly detail?: string;
  readonly error?: string;
}

export type SyncProgressListener = (progress: SyncProgress) => void;

export interface SyncOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: SyncProgressListener;
  /** Skip the EPG pass (e.g. quick refresh of just the catalog). */
  readonly skipEpg?: boolean;
}
