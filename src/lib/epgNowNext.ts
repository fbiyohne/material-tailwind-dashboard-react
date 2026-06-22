import type { EpgEntry } from '@/domain/models';

/** Current (start<=now<end) and next (first start>now) programmes. */
export function findNowNext(
  entries: readonly EpgEntry[],
  nowSecs: number,
): { now: EpgEntry | null; next: EpgEntry | null } {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  let now: EpgEntry | null = null;
  let next: EpgEntry | null = null;
  for (const p of sorted) {
    if (p.start <= nowSecs && nowSecs < p.end) now = p;
    else if (p.start > nowSecs) {
      next = p;
      break;
    }
  }
  return { now, next };
}
