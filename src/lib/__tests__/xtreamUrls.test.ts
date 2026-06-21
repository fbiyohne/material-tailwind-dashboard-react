import { describe, expect, it } from '@jest/globals';
import { XtreamProvider } from '@/providers/xtream/XtreamProvider';

const provider = new XtreamProvider('prof', {
  kind: 'xtream',
  baseUrl: 'http://host:8080/',
  username: 'u',
  password: 'p',
});

describe('XtreamProvider URL building', () => {
  it('builds the live URL', () => {
    expect(provider.buildLiveUrl('123')).toBe('http://host:8080/live/u/p/123.m3u8');
  });

  it('builds the movie URL with container extension', () => {
    expect(provider.buildMovieUrl('5', 'mkv')).toBe('http://host:8080/movie/u/p/5.mkv');
  });

  it('builds the catch-up timeshift URL (minutes / Y-m-d:H-i / id.ts)', () => {
    const start = Date.UTC(2024, 0, 1, 12, 30, 0) / 1000;
    expect(provider.buildCatchupUrl('123', start, 90)).toBe(
      'http://host:8080/timeshift/u/p/90/2024-01-01:12-30/123.ts',
    );
  });
});
