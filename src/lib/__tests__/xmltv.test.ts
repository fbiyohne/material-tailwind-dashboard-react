import { describe, expect, it } from '@jest/globals';
import { parseXmltv, parseXmltvTime } from '@/lib/parsers/xmltv';

describe('parseXmltvTime', () => {
  it('parses a timestamp with timezone offset to UTC epoch seconds', () => {
    // 2024-01-01 12:00:00 +0200 == 10:00:00 UTC
    const epoch = parseXmltvTime('20240101120000 +0200');
    expect(epoch).toBe(Date.UTC(2024, 0, 1, 10, 0, 0) / 1000);
  });

  it('treats a timestamp without offset as UTC', () => {
    const epoch = parseXmltvTime('20240101120000');
    expect(epoch).toBe(Date.UTC(2024, 0, 1, 12, 0, 0) / 1000);
  });

  it('returns null for garbage', () => {
    expect(parseXmltvTime('not-a-date')).toBeNull();
  });
});

describe('parseXmltv', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="france2.fr">
    <display-name>France 2</display-name>
    <icon src="http://logo/f2.png" />
  </channel>
  <programme start="20240101120000 +0000" stop="20240101130000 +0000" channel="france2.fr">
    <title>Journal</title>
    <desc>Les infos</desc>
  </programme>
  <programme start="20240101130000 +0000" stop="20240101140000 +0000" channel="france2.fr">
    <title>Film</title>
  </programme>
</tv>`;

  it('extracts channels with icons', () => {
    const { channels } = parseXmltv(xml);
    expect(channels).toHaveLength(1);
    expect(channels[0]).toEqual({
      id: 'france2.fr',
      displayName: 'France 2',
      iconUrl: 'http://logo/f2.png',
    });
  });

  it('extracts programmes with parsed times', () => {
    const { programmes } = parseXmltv(xml);
    expect(programmes).toHaveLength(2);
    expect(programmes[0]).toMatchObject({
      channelId: 'france2.fr',
      title: 'Journal',
      description: 'Les infos',
      start: Date.UTC(2024, 0, 1, 12, 0, 0) / 1000,
      end: Date.UTC(2024, 0, 1, 13, 0, 0) / 1000,
    });
    expect(programmes[1].description).toBeNull();
  });

  it('skips programmes with invalid times', () => {
    const broken = `<tv><programme start="bad" stop="also-bad" channel="x"><title>Y</title></programme></tv>`;
    expect(parseXmltv(broken).programmes).toHaveLength(0);
  });
});
