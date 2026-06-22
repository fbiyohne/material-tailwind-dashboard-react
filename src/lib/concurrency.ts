/**
 * Run an async mapper over items with a bounded number of concurrent workers.
 *
 * Used for catalog maintenance (stream health probes, TMDB lookups) so we never
 * flood a provider or the network — IPTV servers throttle aggressively.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
      done++;
      onProgress?.(done, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
