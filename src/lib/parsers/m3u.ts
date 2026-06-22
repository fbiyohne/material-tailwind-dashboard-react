/**
 * M3U / M3U8 playlist parser.
 *
 * Pure and synchronous so it can be unit-tested with fixtures and, later, run
 * off the JS thread on a worklet for huge playlists. Robust against the usual
 * real-world messiness: commas inside quoted attribute values, missing
 * attributes, `#EXTGRP` group overrides, and stray comment lines.
 */

export interface M3uEntry {
  /** Display name (text after the comma on the #EXTINF line). */
  readonly name: string;
  /** The stream URL on the line following #EXTINF. */
  readonly url: string;
  /** Raw `tvg-*` / `group-title` attributes, keys lowercased. */
  readonly attributes: Readonly<Record<string, string>>;
  readonly tvgId: string | null;
  readonly tvgName: string | null;
  readonly tvgLogo: string | null;
  readonly groupTitle: string | null;
  /** `tvg-chno` channel number, parsed when present. */
  readonly channelNumber: number | null;
  /** Catch-up window in days (`catchup-days` / `tvg-rec` / `timeshift`). */
  readonly catchupDays: number | null;
}

interface ExtInf {
  readonly attributes: Record<string, string>;
  readonly title: string;
}

const ATTR_RE = /([A-Za-z0-9_-]+)="([^"]*)"/g;

function parseExtInf(line: string): ExtInf {
  const attributes: Record<string, string> = {};
  let lastAttrEnd = -1;
  ATTR_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(line)) !== null) {
    attributes[match[1].toLowerCase()] = match[2];
    lastAttrEnd = ATTR_RE.lastIndex;
  }
  // The title is whatever follows the first comma AFTER the last attribute,
  // so commas inside quoted attribute values never confuse us.
  const commaIdx = lastAttrEnd >= 0 ? line.indexOf(',', lastAttrEnd) : line.indexOf(',');
  const title = commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
  return { attributes, title };
}

function toNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/** Parse a full playlist string into entries. */
export function parseM3u(content: string): M3uEntry[] {
  const entries: M3uEntry[] = [];
  const lines = content.split(/\r?\n/);

  let pending: ExtInf | null = null;
  let groupOverride: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (line.startsWith('#EXTINF:')) {
      pending = parseExtInf(line.slice('#EXTINF:'.length));
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      groupOverride = line.slice('#EXTGRP:'.length).trim() || null;
      continue;
    }
    // Ignore the header and any other directive lines (#EXTM3U, #KODIPROP…).
    if (line.startsWith('#')) continue;

    // A non-comment line is a URL; it belongs to the pending #EXTINF.
    if (pending) {
      const attrs = pending.attributes;
      const groupTitle = attrs['group-title'] ?? groupOverride;
      entries.push({
        name: pending.title || attrs['tvg-name'] || 'Unknown',
        url: line,
        attributes: attrs,
        tvgId: attrs['tvg-id'] ?? null,
        tvgName: attrs['tvg-name'] ?? null,
        tvgLogo: attrs['tvg-logo'] ?? null,
        groupTitle: groupTitle ?? null,
        channelNumber: toNumberOrNull(attrs['tvg-chno'] ?? attrs['channel-number']),
        catchupDays: toNumberOrNull(
          attrs['catchup-days'] ?? attrs['tvg-rec'] ?? attrs['timeshift'],
        ),
      });
      pending = null;
      groupOverride = null;
    }
  }

  return entries;
}
