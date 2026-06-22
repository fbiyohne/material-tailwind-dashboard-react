import { catalogRepo } from '@/data';
import { mapWithConcurrency } from '@/lib/concurrency';
import { httpRequest } from '@/lib/net/http';
import type { ContentProvider } from '@/providers';

export interface HealthCheckOptions {
  /** Max channels to probe in one run (servers throttle — keep it bounded). */
  limit?: number;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

export interface HealthCheckResult {
  checked: number;
  deadIds: string[];
}

/**
 * Probe live stream URLs and report the dead ones.
 *
 * Bounded + low-concurrency on purpose: IPTV servers cap simultaneous
 * connections, so we sample (default 300) with a short timeout. A stream counts
 * as dead on a network error or a >=400 response. This is inherently best-effort
 * (geo/throttling can produce false negatives) — surfaced as a reviewable list,
 * never an automatic silent purge.
 */
export async function healthCheckChannels(
  profileId: string,
  provider: ContentProvider,
  options: HealthCheckOptions = {},
): Promise<HealthCheckResult> {
  const { limit = 300, concurrency = 5, onProgress, signal } = options;
  const all = await catalogRepo.getChannels(profileId, undefined, true);
  const subset = all.slice(0, limit);

  const alive = await mapWithConcurrency(
    subset,
    concurrency,
    async (channel) => {
      try {
        const res = await httpRequest(provider.buildLiveUrl(channel.streamId), {
          timeoutMs: 6000,
          retries: 0,
          signal,
          headers: { Range: 'bytes=0-1' },
        });
        return res.status >= 200 && res.status < 400;
      } catch {
        return false;
      }
    },
    onProgress,
  );

  const deadIds = subset.filter((_, i) => !alive[i]).map((c) => c.id);
  return { checked: subset.length, deadIds };
}

/** Remove the given channels and rebuild the search index. */
export async function purgeChannels(profileId: string, ids: string[]): Promise<void> {
  await catalogRepo.deleteChannelsByIds(ids);
  if (ids.length > 0) await catalogRepo.rebuildSearchIndex(profileId);
}
