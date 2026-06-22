import { describe, expect, it } from '@jest/globals';
import {
  cleanTitleForSearch,
  extractYear,
  normalizeChannelName,
  qualityRank,
} from '@/lib/normalize';

describe('normalizeChannelName', () => {
  it('collapses quality variants to the same key', () => {
    const a = normalizeChannelName('beIN SPORTS 1 FHD');
    const b = normalizeChannelName('BEIN Sports 1 [HD]');
    const c = normalizeChannelName('Bein  Sports  1  4K');
    expect(a).toBe('bein sports 1');
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('strips accents and punctuation', () => {
    expect(normalizeChannelName('Télé-Réalité +')).toBe('tele realite');
  });
});

describe('qualityRank', () => {
  it('ranks higher qualities above lower ones', () => {
    expect(qualityRank('Chan 4K')).toBeGreaterThan(qualityRank('Chan FHD'));
    expect(qualityRank('Chan FHD')).toBeGreaterThan(qualityRank('Chan HD'));
    expect(qualityRank('Chan HD')).toBeGreaterThan(qualityRank('Chan SD'));
    expect(qualityRank('Chan')).toBe(0);
  });
});

describe('cleanTitleForSearch / extractYear', () => {
  it('extracts the year and cleans the title', () => {
    expect(extractYear('Inception (2010)')).toBe(2010);
    expect(cleanTitleForSearch('Inception (2010) 1080p')).toBe('Inception');
  });

  it('returns null when there is no year', () => {
    expect(extractYear('Some Movie')).toBeNull();
  });
});
