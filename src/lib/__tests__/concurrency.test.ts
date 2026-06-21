import { describe, expect, it } from '@jest/globals';
import { mapWithConcurrency } from '@/lib/concurrency';

describe('mapWithConcurrency', () => {
  it('maps every item, preserving order', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('reports progress for each completed item', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3], 1, async (n) => n, (done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3]);
  });
});
