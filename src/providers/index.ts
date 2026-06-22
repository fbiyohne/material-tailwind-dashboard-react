import type { ProviderConfig } from '@/domain/provider-config';
import type { ContentProvider } from './ContentProvider';
import { M3uProvider } from './m3u/M3uProvider';
import { XtreamProvider } from './xtream/XtreamProvider';

export type { ContentProvider, ContentProviderFactory } from './ContentProvider';
export { ProviderError } from './errors';
export type { ProviderErrorCode } from './errors';

/**
 * The single entry point that turns a stored config into a live provider.
 * Add a new source = add one `case` here; nothing else in the app changes.
 */
export function createProvider(
  profileId: string,
  config: ProviderConfig,
): ContentProvider {
  switch (config.kind) {
    case 'xtream':
      return new XtreamProvider(profileId, config);
    case 'm3u':
      return new M3uProvider(profileId, config);
    default: {
      const _exhaustive: never = config;
      throw new Error(`Unknown provider kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
