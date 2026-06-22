# Guide "En ce moment" hero + polished 24h grid — design

Date: 2026-06-22
Status: approved (brainstorming)

## Goal

Make the Guide/EPG the signature surface of CreaticTV. Add a "now-first" hero —
the currently-airing programme of a selected channel, styled with the editorial
serif identity — above the existing 24-hour horizontal grid, which is kept and
polished (jump-to-now, current-programme highlight, clearer catch-up, loading
and empty states).

## Non-goals

- No replacing the 24h grid (kept on purpose).
- No TMDB/image enrichment of EPG programmes (live EPG has no images; the hero
  uses the channel logo + a themed backdrop).
- No change to the full-screen player or catch-up URL logic (reused).

## Approach

Reuse the data the Guide already loads (`epgRepo.getProgrammesInWindow` over a
24h window, grouped into `byChannel: Map<epgChannelId, EpgEntry[]>`). Derive the
hero's now/next from that map with a small pure helper (unit-tested) instead of a
new query. Reuse `elapsedFraction`, `HeaderBar`, `CategoryChips`, `EmptyState`,
`Skeleton`, and the existing `canCatchup`/`playProgramme` logic. Add one
presentational component (`NowHero`) and a small `findNowNext` helper.

## Components & helpers

### `findNowNext` (`src/lib/epgNowNext.ts`, unit-tested)

```ts
findNowNext(entries: readonly EpgEntry[], nowSecs: number): {
  now: EpgEntry | null;
  next: EpgEntry | null;
}
```
- `now` = the entry with `start <= nowSecs < end` (or null).
- `next` = the first entry with `start > nowSecs` (entries assumed time-sorted;
  the helper sorts defensively).

### `NowHero` (`src/ui/components/NowHero.tsx`)

- Props: `{ channel: Channel | null; now: EpgEntry | null; next: EpgEntry | null; onPress: () => void }`.
- Renders a card (surfaceElevated) with the channel logo as a soft large backdrop
  (low opacity) + foreground content:
  - `● EN DIRECT` pill (live dot) when `now` exists.
  - Programme title in `display`/`title` (Fraunces serif), `numberOfLines={2}`.
  - Time range `HH:MM–HH:MM` + a progress bar (`elapsedFraction(now.start, now.end, nowSecs)`).
  - `À SUIVRE` line: next title + start time.
- No `now` → channel name + "Pas de programme en cours."
- Whole card is a `Pressable` → `onPress` (play live).

## Guide screen changes (`src/app/guide.tsx`)

- New state `selectedChannel: Channel | null`; default to `channels[0]` once
  channels load (functional update inside the channels effect's `.then`, never a
  synchronous `setState` in an effect body).
- Render order: `HeaderBar` → `CategoryChips` → `NowHero` (derived from
  `byChannel.get(selectedChannel.epgChannelId)` via `findNowNext`) → the 24h grid.
- **Channel selection from the grid:** the left channel-column rows become
  `Pressable`; tapping a channel name sets `selectedChannel` (updates the hero).
  The active channel row is highlighted (accent left-border / tint).
- **Jump to now:** a small "Maintenant" button (Feather `clock` / `disc`) near the
  header scrolls the horizontal grid `ScrollView` (via a ref) to `nowX` minus a
  small lead margin.
- **Current-programme highlight:** a programme cell whose `start <= now < end`
  gets an accent border + slightly stronger surface.
- **Catch-up icon:** replace the `⟲` glyph with Feather `rotate-ccw` in replayable
  cells.
- **States:** while channels/EPG are loading, show `Skeleton` rows in the channel
  column and a skeleton hero; if there are no channels, show `EmptyState`
  (`icon="radio"`).

## Edge cases

- Selected channel has no `epgChannelId` or no programmes → hero shows the
  "Pas de programme en cours." fallback; grid row is empty (existing behavior).
- `nowX` outside the window → no now-line / jump scrolls to 0 (guarded).
- Catch-up only for past programmes inside the archive window (existing `canCatchup`).
- Parental-locked categories already gated upstream (unchanged).

## Testing

- `findNowNext` pure helper — unit tests: now in the middle, exactly at a
  boundary, before the first, after the last, empty list, unsorted input.
- `NowHero`, grid polish, jump-to-now, selection → manual verification on the
  emulator (the iptv-org M3U has some channels with XMLTV; pick one with EPG).

## Files

- New: `src/lib/epgNowNext.ts` + `src/lib/__tests__/epgNowNext.test.ts`.
- New: `src/ui/components/NowHero.tsx` (+ export in `src/ui/components/index.ts`).
- Modify: `src/app/guide.tsx` (state, hero, selectable channel column,
  jump-to-now, current-cell highlight, catch-up icon, loading/empty states).
