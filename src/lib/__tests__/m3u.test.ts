import { describe, expect, it } from '@jest/globals';
import { parseM3u } from '@/lib/parsers/m3u';

describe('parseM3u', () => {
  it('parses tvg attributes, group-title and display name', () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="france2.fr" tvg-name="France 2" tvg-logo="http://logo/f2.png" group-title="National",France 2 HD
http://host/live/u/p/101.ts`;
    const entries = parseM3u(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: 'France 2 HD',
      url: 'http://host/live/u/p/101.ts',
      tvgId: 'france2.fr',
      tvgName: 'France 2',
      tvgLogo: 'http://logo/f2.png',
      groupTitle: 'National',
    });
  });

  it('keeps commas inside the display name and quoted attribute values', () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="x" group-title="Movies, HD",Lock, Stock and Two Barrels
http://host/movie.mp4`;
    const [entry] = parseM3u(playlist);
    expect(entry.groupTitle).toBe('Movies, HD');
    expect(entry.name).toBe('Lock, Stock and Two Barrels');
  });

  it('applies #EXTGRP group overrides and parses tvg-chno', () => {
    const playlist = `#EXTM3U
#EXTGRP:Sports
#EXTINF:-1 tvg-chno="205" tvg-name="BeIN",BeIN Sports
http://host/bein.ts`;
    const [entry] = parseM3u(playlist);
    expect(entry.groupTitle).toBe('Sports');
    expect(entry.channelNumber).toBe(205);
  });

  it('falls back to tvg-name when there is no display title', () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-name="Fallback Channel",
http://host/x.ts`;
    const [entry] = parseM3u(playlist);
    expect(entry.name).toBe('Fallback Channel');
  });

  it('ignores blank lines and unknown directives', () => {
    const playlist = `#EXTM3U

#KODIPROP:inputstream=inputstream.adaptive
#EXTINF:-1,Plain Channel
http://host/plain.ts
`;
    const entries = parseM3u(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Plain Channel');
  });
});
