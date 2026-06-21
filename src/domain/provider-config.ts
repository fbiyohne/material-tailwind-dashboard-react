/**
 * Provider configuration & session shapes.
 *
 * A "profile" in CreaticTV is one configured provider (the user can have many
 * and switch between them). The credentials live encrypted on-device only and
 * are never sent anywhere except the user's own provider.
 */

export type ProviderKind = 'xtream' | 'm3u';

/** Xtream Codes provider: base URL + username/password. */
export interface XtreamConfig {
  readonly kind: 'xtream';
  /** e.g. `http://host:port` (no trailing slash, no path). */
  readonly baseUrl: string;
  readonly username: string;
  readonly password: string;
}

/** M3U provider: a playlist URL plus an optional separate XMLTV EPG URL. */
export interface M3uConfig {
  readonly kind: 'm3u';
  readonly playlistUrl: string;
  readonly epgUrl: string | null;
}

export type ProviderConfig = XtreamConfig | M3uConfig;

/** A configured provider as the user sees it (no secrets in this shape). */
export interface Profile {
  readonly id: string;
  readonly name: string;
  readonly kind: ProviderKind;
  readonly createdAt: number;
  readonly lastUsedAt: number;
  /** Last successful catalog import timestamp, if any. */
  readonly lastSyncedAt: number | null;
}

/** Result of authenticating against a provider. */
export interface ProviderSession {
  readonly authenticated: boolean;
  /** Provider-reported account expiry (epoch seconds), when known. */
  readonly expiresAt: number | null;
  /** Max simultaneous connections, when known. */
  readonly maxConnections: number | null;
  /** Free-form server info for diagnostics. */
  readonly serverInfo: Readonly<Record<string, string>> | null;
}

/** Options influencing how a playback URL is built. */
export interface StreamUrlOptions {
  /** For catch-up: start time (epoch seconds) and duration (minutes). */
  readonly catchup?: { readonly start: number; readonly durationMin: number };
}
