# Live preview pane + EPG — design

Date: 2026-06-22
Status: approved (brainstorming)

## Goal

On the Live TV screen, let the user preview a channel inline — a small video
that plays the selected channel together with its now/next guide — before (or
instead of) going full-screen, the way IPTV Smarters Pro and StreamVault do.
Layout adapts to orientation: preview on top in portrait, a split (list left,
preview + guide right) in landscape.

## Non-goals

- No picture-in-picture or multi-view (later phase).
- No change to the full-screen player itself (reused as-is).
- No new EPG data work — reuse the existing `epgRepo.getNowNext`.

## Approach

Inline preview + reuse the existing full-screen player. The preview is a small
16:9 `react-native-video` instance inside the Live screen. Going full-screen
navigates to the existing `/player` route (its own video instance). This ships
fastest and reuses the already-polished player. The brief stream reload when
entering full-screen is acceptable.

Rejected alternatives: a single "shared" video that animates from preview to
full-screen without reloading (elegant but complex — shared element +
orientation + state); promoting the preview into a modal (middle ground, still
more moving parts). Neither is worth the risk for v1.

## Components

### `LivePreview` (`src/ui/components/LivePreview.tsx`)

A self-contained 16:9 inline player.

- Props: `{ channel: Channel | null; streamUrl: string | null; onFullscreen: () => void; }`
- When `channel`/`streamUrl` is null → placeholder: channel-less surface with the
  brand mark and the copy "Touchez une chaîne pour la prévisualiser."
- When set → `react-native-video` plays `streamUrl` with sound, `resizeMode="contain"`,
  16:9 box. A bottom scrim shows the channel name; a top-right full-screen icon
  (Feather `maximize`). Tapping anywhere on the preview calls `onFullscreen`.
- Buffering spinner (themed). On `onError` → an overlay "Flux indisponible"
  (the list stays usable; selecting another channel retries).
- Only one video instance exists; changing `streamUrl` swaps the source.

### `NowNextStrip` (`src/ui/components/NowNextStrip.tsx`)

Now/next guide for the selected channel.

- Props: `{ profileId: string | null; channel: Channel | null; }`
- Fetches `epgRepo.getNowNext(profileId, channel.epgChannelId)` when channel changes.
- Renders: a "● MAINTENANT" row (live dot + current title + `HH:MM–HH:MM`) with a
  thin progress bar of elapsed fraction of the current programme; an "À SUIVRE"
  row (next title + start time).
- No EPG / no channel → muted "Pas de programme pour cette chaîne."

## Live screen changes (`src/app/(tabs)/live.tsx`)

- New state: `selectedChannel: Channel | null` and a debounced `previewUrl`.
- Selecting a channel sets `selectedChannel`; a ~400 ms debounce then sets
  `previewUrl = provider.buildLiveUrl(channel.streamId)` so fast zapping does not
  reload the stream on every tap.
- `ChannelRow` interaction changes:
  - `onPress` → select the channel (load the preview), no longer full-screen.
  - `onLongPress` → go straight to full-screen (`openChannel`).
- `LivePreview.onFullscreen` and the preview tap → `openChannel(selectedChannel)`
  (existing `/player` navigation).
- Leaving the Live tab pauses the preview (via `useFocusEffect`); returning resumes.
- Recents/Favorites shelves stay, rendered below the channel list (the preview +
  now/next take the top slot).

### Responsive layout (`useWindowDimensions`)

- `isWide = width > height` (landscape) — later also true for tablets by width.
- Portrait: `[ header ] → [ LivePreview ] → [ NowNextStrip ] → [ CategoryChips ] → [ channel FlashList ]`.
- Landscape (`isWide`): two columns — left ~40 % the channel list (+ chips),
  right ~60 % `LivePreview` (top) + `NowNextStrip` (below). Header spans full width.

## Edge cases

- Stream fails → preview error overlay; list remains usable.
- No EPG for channel → NowNextStrip shows the muted fallback.
- Rapid zapping → 400 ms debounce coalesces selections.
- No provider / no channels → existing `EmptyState` (preview shows placeholder).
- Parental-locked categories already gated upstream (unchanged).

## Testing

- Pure helper for "elapsed fraction" of a programme (start/end/now → 0..1) — unit test.
- Debounce/select logic kept in the screen; covered by manual verification on the
  emulator (preview plays on tap, fullscreen on preview tap, long-press fullscreen,
  portrait vs landscape layouts, error overlay on a dead stream).

## Files

- New: `src/ui/components/LivePreview.tsx`, `src/ui/components/NowNextStrip.tsx`
  (+ exports in `src/ui/components/index.ts`).
- New: a tiny pure helper (e.g. `src/lib/epgProgress.ts`) for elapsed fraction, unit-tested.
- Modified: `src/app/(tabs)/live.tsx` (state, responsive layout, row interactions).
