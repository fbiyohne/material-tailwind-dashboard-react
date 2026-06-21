/** Raw Xtream Codes `player_api.php` response shapes (only fields we use). */

export interface XtreamAuthResponse {
  readonly user_info?: {
    readonly auth?: number;
    readonly status?: string;
    readonly exp_date?: string | null;
    readonly max_connections?: string | null;
  };
  readonly server_info?: Record<string, string | number | null>;
}

export interface XtreamCategory {
  readonly category_id: string;
  readonly category_name: string;
  readonly parent_id?: number | string;
}

export interface XtreamLiveStream {
  readonly stream_id: number;
  readonly name: string;
  readonly stream_icon?: string;
  readonly epg_channel_id?: string | null;
  readonly category_id?: string;
  readonly num?: number;
  readonly added?: string;
  readonly is_adult?: string | number;
  readonly tv_archive?: string | number;
  readonly tv_archive_duration?: string | number;
}

export interface XtreamVodStream {
  readonly stream_id: number;
  readonly name: string;
  readonly stream_icon?: string;
  readonly rating?: string | number;
  readonly category_id?: string;
  readonly container_extension?: string;
  readonly added?: string;
  readonly tmdb?: string | number;
  readonly year?: string | number;
}

export interface XtreamSeries {
  readonly series_id: number;
  readonly name: string;
  readonly cover?: string;
  readonly rating?: string | number;
  readonly category_id?: string;
  readonly year?: string | number;
  readonly tmdb?: string | number;
  readonly last_modified?: string;
}

export interface XtreamSeriesInfo {
  readonly info?: {
    readonly plot?: string;
    readonly cast?: string;
  };
  readonly episodes?: Record<
    string,
    readonly {
      readonly id: string;
      readonly episode_num: number;
      readonly title: string;
      readonly container_extension?: string;
      readonly info?: { readonly duration_secs?: number; readonly plot?: string };
    }[]
  >;
}

export interface XtreamShortEpgEntry {
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly start_timestamp?: string | number;
  readonly stop_timestamp?: string | number;
}

export interface XtreamShortEpgResponse {
  readonly epg_listings?: readonly XtreamShortEpgEntry[];
}
