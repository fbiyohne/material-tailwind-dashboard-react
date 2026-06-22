import { catalogRepo } from '@/data';
import type { Channel } from '@/domain/models';
import { normalizeChannelName, qualityRank } from '@/lib/normalize';

export interface DedupResult {
  /** Number of duplicate groups found. */
  groups: number;
  /** Number of channels removed (kept one per group). */
  removed: number;
}

/**
 * Collapse duplicate channels: group by normalized name, keep the highest
 * quality variant, delete the rest, then rebuild the search index. This is the
 * "assainissement des données provider" the rest of the ecosystem skips.
 */
export async function deduplicateChannels(profileId: string): Promise<DedupResult> {
  const channels = await catalogRepo.getChannels(profileId, undefined, true);

  const groups = new Map<string, Channel[]>();
  for (const c of channels) {
    const key = normalizeChannelName(c.name);
    if (!key) continue; // never dedup unnamed entries
    const arr = groups.get(key);
    if (arr) arr.push(c);
    else groups.set(key, [c]);
  }

  const removeIds: string[] = [];
  let dupGroups = 0;
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    dupGroups++;
    const sorted = [...arr].sort((a, b) => qualityRank(b.name) - qualityRank(a.name));
    removeIds.push(...sorted.slice(1).map((c) => c.id));
  }

  await catalogRepo.deleteChannelsByIds(removeIds);
  if (removeIds.length > 0) await catalogRepo.rebuildSearchIndex(profileId);

  return { groups: dupGroups, removed: removeIds.length };
}
