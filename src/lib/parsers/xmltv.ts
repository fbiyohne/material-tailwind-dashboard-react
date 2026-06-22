import { XMLParser } from 'fast-xml-parser';

/**
 * XMLTV (EPG guide) parser.
 *
 * For the socle this parses an in-memory string. The provider layer exposes the
 * guide as a ReadableStream so the sync orchestrator can later swap in a chunked
 * SAX pass for 100MB+ guides without holding the whole file in memory — the
 * output shapes below stay identical, so nothing downstream changes.
 */

export interface XmltvChannel {
  readonly id: string;
  readonly displayName: string;
  readonly iconUrl: string | null;
}

export interface XmltvProgramme {
  readonly channelId: string;
  readonly title: string;
  readonly description: string | null;
  /** Unix epoch seconds (UTC). */
  readonly start: number;
  readonly end: number;
}

export interface XmltvDocument {
  readonly channels: readonly XmltvChannel[];
  readonly programmes: readonly XmltvProgramme[];
}

const XMLTV_TIME_RE =
  /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\s*([+-])(\d{2})(\d{2}))?/;

/** Parse an XMLTV timestamp ("20240101120000 +0200") to epoch seconds. */
export function parseXmltvTime(value: string): number | null {
  const m = XMLTV_TIME_RE.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, sign, oh, om] = m;
  let ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    s ? Number(s) : 0,
  );
  if (sign && oh && om) {
    const offsetMin = (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1);
    ms -= offsetMin * 60_000;
  }
  return Math.floor(ms / 1000);
}

/** Extract text from a fast-xml-parser node (string | {#text} | array). */
function text(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return text((node as Record<string, unknown>)['#text']);
  }
  return '';
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
});

interface RawNode {
  readonly [key: string]: unknown;
}

export function parseXmltv(xml: string): XmltvDocument {
  const root = parser.parse(xml) as RawNode;
  const tv = (root.tv ?? {}) as RawNode;

  const channels: XmltvChannel[] = asArray(tv.channel as RawNode | RawNode[]).map(
    (ch) => {
      const icon = asArray(ch.icon as RawNode | RawNode[])[0];
      return {
        id: String((ch['@_id'] as string) ?? ''),
        displayName: text(ch['display-name']),
        iconUrl: icon ? ((icon['@_src'] as string) ?? null) : null,
      };
    },
  );

  const programmes: XmltvProgramme[] = [];
  for (const pr of asArray(tv.programme as RawNode | RawNode[])) {
    const start = parseXmltvTime(String((pr['@_start'] as string) ?? ''));
    const end = parseXmltvTime(String((pr['@_stop'] as string) ?? ''));
    const channelId = String((pr['@_channel'] as string) ?? '');
    if (start == null || end == null || !channelId) continue;
    programmes.push({
      channelId,
      title: text(pr.title),
      description: text(pr.desc) || null,
      start,
      end,
    });
  }

  return { channels, programmes };
}
