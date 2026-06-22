# Live preview pane + EPG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline channel preview (video + now/next guide) to the Live screen, responsive between portrait (preview on top) and landscape (list left, preview + guide right).

**Architecture:** A small 16:9 `react-native-video` preview lives inside the Live screen; full-screen reuses the existing `/player` route. Selecting a channel loads the preview (debounced); tapping the preview or long-pressing a row goes full-screen.

**Tech Stack:** React Native 0.85, Expo SDK 56, expo-router, react-native-video, @expo/vector-icons (Feather), Jest.

## Global Constraints

- All styling comes from theme tokens via `useTheme()`; no literal colors except over-video scrims (white / rgba). (copied from existing component conventions)
- Components consume the `Theme` via `useTheme()` and never reference literals for color/space/radius.
- Verify every task with `npm run typecheck` and `npm run lint` (both must exit 0). Pure-logic tasks also run `npm test`.
- Run Node/Metro commands with `NODE_OPTIONS=--dns-result-order=ipv4first` (IPv6 is broken on this network).
- New shared components are exported from `src/ui/components/index.ts`.

---

### Task 1: `elapsedFraction` EPG helper (TDD)

**Files:**
- Create: `src/lib/epgProgress.ts`
- Test: `src/lib/__tests__/epgProgress.test.ts`

**Interfaces:**
- Produces: `elapsedFraction(startSecs: number, endSecs: number, nowSecs: number): number` — clamped 0..1 fraction of a programme elapsed at `nowSecs`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/epgProgress.test.ts
import { elapsedFraction } from '../epgProgress';

describe('elapsedFraction', () => {
  it('is 0 before the programme starts', () => {
    expect(elapsedFraction(100, 200, 50)).toBe(0);
  });
  it('is 1 after the programme ends', () => {
    expect(elapsedFraction(100, 200, 300)).toBe(1);
  });
  it('is 0.5 at the midpoint', () => {
    expect(elapsedFraction(100, 200, 150)).toBeCloseTo(0.5);
  });
  it('is 0 for a zero- or negative-length programme', () => {
    expect(elapsedFraction(200, 200, 200)).toBe(0);
    expect(elapsedFraction(300, 200, 250)).toBe(0);
  });
  it('is 0 for non-finite input', () => {
    expect(elapsedFraction(NaN, 200, 150)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- epgProgress`
Expected: FAIL — cannot find module `../epgProgress`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/epgProgress.ts
/** Fraction (0..1) of a programme elapsed at `nowSecs`. Safe on bad input. */
export function elapsedFraction(
  startSecs: number,
  endSecs: number,
  nowSecs: number,
): number {
  if (
    !Number.isFinite(startSecs) ||
    !Number.isFinite(endSecs) ||
    !Number.isFinite(nowSecs) ||
    endSecs <= startSecs
  ) {
    return 0;
  }
  const f = (nowSecs - startSecs) / (endSecs - startSecs);
  return Math.max(0, Math.min(1, f));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- epgProgress`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/epgProgress.ts src/lib/__tests__/epgProgress.test.ts
git commit -m "feat(epg): elapsedFraction helper for now/next progress"
```

---

### Task 2: `NowNextStrip` component

**Files:**
- Create: `src/ui/components/NowNextStrip.tsx`
- Modify: `src/ui/components/index.ts` (add export)

**Interfaces:**
- Consumes: `elapsedFraction` (Task 1); `epgRepo.getNowNext(profileId, epgChannelId)` → `{ now: EpgEntry | null; next: EpgEntry | null }` where `EpgEntry` has `{ title: string; start: number; end: number }`.
- Produces: `NowNextStrip({ profileId: string | null; channel: Channel | null })`.

- [ ] **Step 1: Implement the component**

```tsx
// src/ui/components/NowNextStrip.tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { epgRepo } from '@/data';
import type { Channel, EpgEntry } from '@/domain/models';
import { elapsedFraction } from '@/lib/epgProgress';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface NowNextStripProps {
  profileId: string | null;
  channel: Channel | null;
}

/** Now/next guide for the selected channel, with an elapsed progress bar. */
export function NowNextStrip({ profileId, channel }: NowNextStripProps) {
  const theme = useTheme();
  const [now, setNow] = useState<EpgEntry | null>(null);
  const [next, setNext] = useState<EpgEntry | null>(null);

  useEffect(() => {
    let active = true;
    setNow(null);
    setNext(null);
    if (!profileId || !channel?.epgChannelId) return;
    void epgRepo
      .getNowNext(profileId, channel.epgChannelId)
      .then((nn) => {
        if (!active) return;
        setNow(nn.now);
        setNext(nn.next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profileId, channel]);

  if (!channel) return null;

  if (!now && !next) {
    return (
      <View style={{ paddingVertical: theme.space.sm }}>
        <AppText variant="caption" muted>
          Pas de programme pour cette chaîne.
        </AppText>
      </View>
    );
  }

  const frac = now ? elapsedFraction(now.start, now.end, Math.floor(Date.now() / 1000)) : 0;

  return (
    <View style={{ gap: theme.space.xs + 2, paddingVertical: theme.space.sm }}>
      {now ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <View
              style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.live }}
            />
            <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {now.title}
            </AppText>
            <AppText variant="mono" muted>
              {hhmm(now.start)}–{hhmm(now.end)}
            </AppText>
          </View>
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: theme.colors.surfaceElevated,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${Math.round(frac * 100)}%`,
                height: '100%',
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        </View>
      ) : null}
      {next ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
          <AppText variant="caption" muted style={{ letterSpacing: 0.6 }}>
            À SUIVRE
          </AppText>
          <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {next.title}
          </AppText>
          <AppText variant="mono" muted>
            {hhmm(next.start)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Add the export**

In `src/ui/components/index.ts`, add (keep alphabetical):

```ts
export { NowNextStrip } from './NowNextStrip';
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. (If `getNowNext` return shape differs, adjust the destructure to match `src/data`'s actual signature — check `epgRepo` exports.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/NowNextStrip.tsx src/ui/components/index.ts
git commit -m "feat(live): NowNextStrip now/next guide component"
```

---

### Task 3: `LivePreview` component

**Files:**
- Create: `src/ui/components/LivePreview.tsx`
- Modify: `src/ui/components/index.ts` (add export)

**Interfaces:**
- Consumes: `react-native-video` default export; `Channel`.
- Produces: `LivePreview({ channel: Channel | null; streamUrl: string | null; onFullscreen: () => void; paused?: boolean })`.

- [ ] **Step 1: Implement the component**

```tsx
// src/ui/components/LivePreview.tsx
import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import type { Channel } from '@/domain/models';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface LivePreviewProps {
  channel: Channel | null;
  streamUrl: string | null;
  onFullscreen: () => void;
  /** Pause playback (e.g. when the Live tab is not focused). */
  paused?: boolean;
}

/** Inline 16:9 channel preview. Tap to go full-screen. */
export function LivePreview({ channel, streamUrl, onFullscreen, paused }: LivePreviewProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  // Reset transient state whenever the stream changes.
  useEffect(() => {
    setLoading(true);
    setErrored(false);
  }, [streamUrl]);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      {streamUrl ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onFullscreen}>
          <Video
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            paused={paused}
            resizeMode="contain"
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setErrored(true);
            }}
          />
          {loading && !errored ? (
            <View style={styles.center} pointerEvents="none">
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : null}
          {errored ? (
            <View style={styles.center} pointerEvents="none">
              <AppText variant="caption" style={{ color: '#fff' }}>
                Flux indisponible
              </AppText>
            </View>
          ) : null}
          {/* Bottom scrim: channel name + fullscreen affordance. */}
          <View style={styles.bottomBar} pointerEvents="none">
            <AppText variant="caption" numberOfLines={1} style={styles.barText}>
              {channel?.name ?? ''}
            </AppText>
            <Feather name="maximize" size={16} color="#fff" />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.center, { padding: theme.space.lg }]} pointerEvents="none">
          <Feather name="play-circle" size={30} color={theme.colors.textMuted} />
          <AppText variant="caption" muted center style={{ marginTop: theme.space.sm }}>
            Touchez une chaîne pour la prévisualiser.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  barText: { flex: 1, color: '#fff' },
});
```

- [ ] **Step 2: Add the export**

In `src/ui/components/index.ts`, add (keep alphabetical):

```ts
export { LivePreview } from './LivePreview';
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/LivePreview.tsx src/ui/components/index.ts
git commit -m "feat(live): inline LivePreview video component"
```

---

### Task 4: Wire preview + responsive layout into the Live screen

**Files:**
- Modify: `src/app/(tabs)/live.tsx`

**Interfaces:**
- Consumes: `LivePreview`, `NowNextStrip` (Tasks 2–3); `useWindowDimensions`; existing `openChannel`.
- Produces: nothing downstream — terminal integration.

This task rewrites the screen body to: hold `selectedChannel` state, derive a debounced `previewUrl`, pause the preview when the tab is unfocused, change `ChannelRow` to select (tap) / full-screen (long-press), and lay out portrait vs landscape.

- [ ] **Step 1: Add imports and selection state**

In `src/app/(tabs)/live.tsx`, add to the react-native import: `useWindowDimensions`. Add `LivePreview` and `NowNextStrip` to the `@/ui/components` import. Inside `LiveScreen`, after the existing state, add:

```tsx
  const { width, height } = useWindowDimensions();
  const isWide = width > height;
  const [selected, setSelectedChannel] = useState<Channel | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPaused, setPreviewPaused] = useState(false);

  // Debounce the preview source so fast zapping doesn't reload on every tap.
  useEffect(() => {
    if (!selected || !provider) {
      setPreviewUrl(null);
      return;
    }
    const channel = selected;
    const id = setTimeout(() => {
      setPreviewUrl(provider.buildLiveUrl(channel.streamId));
    }, 400);
    return () => clearTimeout(id);
  }, [selected, provider]);
```

> Note: the existing `selected`/`setSelected` for the **category** filter must be
> renamed to avoid collision. Rename the category state to `selectedCategory` /
> `setSelectedCategory` throughout the file (it is used in the category effect,
> `CategoryChips`, and `getChannels`). Use `selected` only for the channel.

- [ ] **Step 2: Pause the preview when the tab loses focus**

Extend the existing `useFocusEffect` (or add one) so the preview pauses off-screen:

```tsx
  useFocusEffect(
    useCallback(() => {
      setPreviewPaused(false);
      void refreshShelves();
      return () => setPreviewPaused(true);
    }, [refreshShelves]),
  );
```

- [ ] **Step 3: Change row interaction (tap = select, long-press = full-screen)**

In `ChannelRow`, add an `onLongPress` prop and pass both handlers to `ListRow`
(`ListRow` already forwards `onPress`; add `onLongPress` passthrough to `ListRow`'s
`Pressable` — one-line change in `ListRow.tsx`: add `onLongPress?: () => void` to its
props and spread it onto the `Pressable`). In the screen, render rows with:

```tsx
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              profileId={profileId}
              onPress={() => setSelectedChannel(item)}
              onLongPress={() => openChannel(item)}
            />
          )}
```

- [ ] **Step 4: Build the preview block and responsive layout**

Define a `Preview` element and place it per orientation. Portrait: above the
category chips. Landscape: in a right column beside the list. Concretely, replace
the screen's returned layout so that:

```tsx
  const previewBlock = (
    <View style={{ gap: theme.space.xs }}>
      <LivePreview
        channel={selected}
        streamUrl={previewUrl}
        paused={previewPaused}
        onFullscreen={() => selected && openChannel(selected)}
      />
      <NowNextStrip profileId={profileId} channel={selected} />
    </View>
  );

  return (
    <Screen padded={false} edges={['top']}>
      {isWide ? (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ flex: 4, paddingHorizontal: theme.space.lg }}>
            <FlashList
              data={channels}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={Header}
              ListEmptyComponent={<EmptyState icon="radio" title={t('live.noChannels')} />}
              renderItem={({ item }) => (
                <ChannelRow
                  channel={item}
                  profileId={profileId}
                  onPress={() => setSelectedChannel(item)}
                  onLongPress={() => openChannel(item)}
                />
              )}
            />
          </View>
          <View style={{ flex: 6, padding: theme.space.lg }}>{previewBlock}</View>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
          <FlashList
            data={channels}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View>
                {previewBlock}
                {Header}
              </View>
            }
            ListEmptyComponent={<EmptyState icon="radio" title={t('live.noChannels')} />}
            renderItem={({ item }) => (
              <ChannelRow
                channel={item}
                profileId={profileId}
                onPress={() => setSelectedChannel(item)}
                onLongPress={() => openChannel(item)}
              />
            )}
          />
        </View>
      )}
    </Screen>
  );
```

> In landscape, `Header` (title + Guide button + shelves + chips) is heavy; keep it
> in the list header of the left column. The portrait branch nests `previewBlock`
> above `Header` inside `ListHeaderComponent`.

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0. Fix any unused-import or renamed-symbol errors from the
`selected` → `selectedCategory` rename.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(tabs)/live.tsx" src/ui/components/ListRow.tsx
git commit -m "feat(live): inline channel preview + now/next, responsive layout"
```

---

### Task 5: Manual verification on the emulator

**Files:** none (verification only; commit only if fixes are needed).

- [ ] **Step 1: Reload the app** (Metro running; `adb` reverse set) and open the Live tab.

- [ ] **Step 2: Portrait checks**
  - Preview placeholder shows before any tap ("Touchez une chaîne…").
  - Tap a working channel (e.g. France 24 / FilmRise) → preview plays with sound within ~1s.
  - Now/Next strip shows current programme + progress bar when EPG exists, else the fallback copy.
  - Tap the preview → full-screen player opens on the same channel.
  - Long-press a row → full-screen opens directly.

- [ ] **Step 3: Landscape checks**
  - Rotate the emulator: layout becomes list-left / preview+guide-right.
  - Selecting a channel updates the right column.

- [ ] **Step 4: Edge cases**
  - Tap a dead channel (e.g. a `—` placeholder one) → "Flux indisponible" overlay; list still usable.
  - Zap quickly across several channels → only the last loads (debounce).

- [ ] **Step 5: Re-run checks** `npm run typecheck && npm run lint && npm test` → all green. Commit any fixes.

## Self-Review

- **Spec coverage:** preview component (Task 3), now/next (Task 2 + Task 1 helper), tap=preview / tap-preview=fullscreen / long-press=fullscreen (Task 4 Step 3–4), debounce (Task 4 Step 1), pause-on-blur (Task 4 Step 2), responsive portrait/landscape (Task 4 Step 4), error overlay + no-EPG fallback (Tasks 2–3), unit-tested pure helper (Task 1). All spec sections covered.
- **Placeholder scan:** none — every step carries real code or exact commands.
- **Type consistency:** `elapsedFraction(start,end,now)` used identically in Task 1 and Task 2; `LivePreview`/`NowNextStrip` prop names match between definition and Task 4 usage; the category-state rename note prevents the `selected` collision.
