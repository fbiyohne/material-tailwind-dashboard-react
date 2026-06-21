import { describe, expect, it } from '@jest/globals';
import { parseNlQuery } from '@/services/nlSearch';

// Fixed reference time: 2024-06-01 10:00 local.
const NOW = Math.floor(new Date(2024, 5, 1, 10, 0, 0).getTime() / 1000);

describe('parseNlQuery', () => {
  it('parses "les matchs de foot ce soir" as an EPG query with a window', () => {
    const q = parseNlQuery('les matchs de foot ce soir', NOW);
    expect(q.epg).toBe(true);
    expect(q.window).not.toBeNull();
    expect(q.keywords).toContain('foot');
    expect(q.keywords).toContain('football'); // synonym expansion
    expect(q.kind).toBeNull();
  });

  it('parses "films d\'action" as a movie catalog query (no window)', () => {
    const q = parseNlQuery("films d'action", NOW);
    expect(q.kind).toBe('movie');
    expect(q.window).toBeNull();
    expect(q.epg).toBe(false);
    expect(q.keywords).toContain('action');
  });

  it('treats "maintenant" as a now window', () => {
    const q = parseNlQuery('sport maintenant', NOW);
    expect(q.epg).toBe(true);
    expect(q.window?.from).toBe(NOW);
    expect(q.window?.to).toBe(NOW + 3 * 3600);
  });

  it('drops stopwords and temporal words from keywords', () => {
    const q = parseNlQuery('what is on tonight', NOW);
    expect(q.keywords).toEqual([]);
    expect(q.window).not.toBeNull();
  });
});
