# Guide "En ce moment" hero + polished 24h grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a now-first `NowHero` above the kept-and-polished 24h EPG grid on the Guide screen.

**Architecture:** Reuse the Guide's existing 24h window data (`byChannel` map). Derive the hero's now/next with a pure tested helper. Add one presentational component; make the grid's channel column selectable and add jump-to-now, current-cell highlight, a Feather catch-up icon, and loading/empty states.

**Tech Stack:** React Native 0.85, Expo SDK 56, expo-router, expo-image, @expo/vector-icons (Feather), Jest.

## Global Constraints

- All color/space/radius from theme tokens via `useTheme()`; literals only for over-image scrims.
- No `Date.now()`/`Math.random()` during render (react-hooks/purity) — pass the captured `nowBase` (mount-time seconds) down as a prop.
- No synchronous `setState` in a `useEffect` body (react-hooks/set-state-in-effect) — set defaults inside async `.then` with a functional update.
- Test files import jest globals: `import { describe, expect, it } from '@jest/globals';`.
- Verify each task with `npm run typecheck` and `npm run lint` (exit 0); logic tasks also `npm test`.
- Run npm with `NODE_OPTIONS=--dns-result-order=ipv4first`.

---

### Task 1: `findNowNext` helper (TDD)

**Files:**
- Create: `src/lib/epgNowNext.ts`
- Test: `src/lib/__tests__/epgNowNext.test.ts`

**Interfaces:**
- Produces: `findNowNext(entries: readonly EpgEntry[], nowSecs: number): { now: EpgEntry | null; next: EpgEntry | null }`. `now` = entry with `start <= nowSecs < end`; `next` = first entry with `start > nowSecs`. Sorts defensively by `start`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/epgNowNext.test.ts
import { describe, expect, it } from '@jest/globals';
import type { EpgEntry } from '@/domain/models';
import { findNowNext } from '../epgNowNext';

const e = (id: string, start: number, end: number): EpgEntry => ({
  id,
  profileId: 'p',
  epgChannelId: 'c',
  title: id,
  description: null,
  start,
  end,
});

describe('findNowNext', () => {
  const list = [e('a', 100, 200), e('b', 200, 300), e('c', 300, 400)];

  it('finds the current and next programme', () => {
    const r = findNowNext(list, 250);
    expect(r.now?.id).toBe('b');
    expect(r.next?.id).toBe('c');
  });
  it('treats start as inclusive, end as exclusive', () => {
    expect(findNowNext(list, 200).now?.id).toBe('b');
    expect(findNowNext(list, 300).now?.id).toBe('c');
  });
  it('before the first: no now, next is the first', () => {
    const r = findNowNext(list, 50);
    expect(r.now).toBeNull();
    expect(r.next?.id).toBe('a');
  });
  it('after the last: no now, no next', () => {
    const r = findNowNext(list, 500);
    expect(r.now).toBeNull();
    expect(r.next).toBeNull();
  });
  it('handles an empty list', () => {
    expect(findNowNext([], 100)).toEqual({ now: null, next: null });
  });
  it('sorts unsorted input', () => {
    const r = findNowNext([e('c', 300, 400), e('a', 100, 200), e('b', 200, 300)], 150);
    expect(r.now?.id).toBe('a');
    expect(r.next?.id).toBe('b');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- epgNowNext`
Expected: FAIL — cannot find module `../epgNowNext`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/epgNowNext.ts
import type { EpgEntry } from '@/domain/models';

/** Current (start<=now<end) and next (first start>now) programmes. */
export function findNowNext(
  entries: readonly EpgEntry[],
  nowSecs: number,
): { now: EpgEntry | null; next: EpgEntry | null } {
  const sorted = [...entries].sort((a, b) => a.start - b.start);
  let now: EpgEntry | null = null;
  let next: EpgEntry | null = null;
  for (const p of sorted) {
    if (p.start <= nowSecs && nowSecs < p.end) now = p;
    else if (p.start > nowSecs) {
      next = p;
      break;
    }
  }
  return { now, next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- epgNowNext`
Expected: PASS (6 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/epgNowNext.ts src/lib/__tests__/epgNowNext.test.ts
git commit -m "feat(epg): findNowNext helper"
```

---

### Task 2: `NowHero` component

**Files:**
- Create: `src/ui/components/NowHero.tsx`
- Modify: `src/ui/components/index.ts` (add export, alphabetical — after `ListRow`/`LivePreview`/`NowNextStrip`)

**Interfaces:**
- Consumes: `elapsedFraction` (existing); `Channel`, `EpgEntry`.
- Produces: `NowHero({ channel: Channel | null; now: EpgEntry | null; next: EpgEntry | null; nowSecs: number; onPress: () => void })`.

- [ ] **Step 1: Implement the component**

```tsx
// src/ui/components/NowHero.tsx
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Channel, EpgEntry } from '@/domain/models';
import { elapsedFraction } from '@/lib/epgProgress';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface NowHeroProps {
  channel: Channel | null;
  now: EpgEntry | null;
  next: EpgEntry | null;
  /** Mount-time seconds (no Date.now() in render). */
  nowSecs: number;
  onPress: () => void;
}

/** "En ce moment" hero — the current programme of the selected channel. */
export function NowHero({ channel, now, next, nowSecs, onPress }: NowHeroProps) {
  const theme = useTheme();
  if (!channel) return null;
  const frac = now ? elapsedFraction(now.start, now.end, nowSecs) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.space.lg,
          opacity: pressed ? 0.9 : 1,
        },
        theme.shadow.card,
      ]}>
      {/* Channel logo as a soft backdrop. */}
      {channel.logoUrl ? (
        <Image
          source={{ uri: channel.logoUrl }}
          style={[StyleSheet.absoluteFill, { opacity: 0.08 }]}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        {now ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: theme.colors.danger,
            }}
          />
        ) : null}
        <AppText variant="caption" muted style={{ letterSpacing: 1, color: theme.colors.text }}>
          {now ? 'EN DIRECT' : channel.name}
        </AppText>
      </View>

      <AppText variant="title" numberOfLines={2} style={{ marginTop: theme.space.xs }}>
        {now ? now.title : 'Pas de programme en cours.'}
      </AppText>

      {now ? (
        <View style={{ marginTop: theme.space.sm, gap: 6 }}>
          <AppText variant="mono" muted>
            {hhmm(now.start)}–{hhmm(now.end)}
          </AppText>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.surface,
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            marginTop: theme.space.sm,
          }}>
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
    </Pressable>
  );
}
```

- [ ] **Step 2: Export it** — add to `src/ui/components/index.ts`:

```ts
export { NowHero } from './NowHero';
```

- [ ] **Step 3: Verify** — `npm run typecheck && npm run lint` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/NowHero.tsx src/ui/components/index.ts
git commit -m "feat(guide): NowHero En ce moment component"
```

---

### Task 3: Wire the hero + polish into the Guide screen

**Files:**
- Modify: `src/app/guide.tsx` (full replacement below)

**Interfaces:**
- Consumes: `NowHero`, `findNowNext`, `EmptyState`, `Skeleton`, `Feather`. Terminal integration.

- [ ] **Step 1: Replace `src/app/guide.tsx` with the following**

```tsx
import { Feather } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { catalogRepo, epgRepo } from '@/data';
import type { Category, Channel, EpgEntry } from '@/domain/models';
import { findNowNext } from '@/lib/epgNowNext';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import {
  AppText,
  CategoryChips,
  EmptyState,
  HeaderBar,
  NowHero,
  Screen,
  Skeleton,
} from '@/ui/components';

const HOUR_W = 200; // px per hour
const PX_PER_MIN = HOUR_W / 60;
const ROW_H = 60;
const LABEL_W = 116;
const HEADER_H = 34;
const WINDOW_HOURS = 24;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function GuideScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);
  const unlocked = useParentalStore((s) => s.unlocked);

  const [nowBase] = useState(() => Math.floor(Date.now() / 1000));
  const windowStart = Math.floor(nowBase / 1800) * 1800 - 3600;
  const windowEnd = windowStart + WINDOW_HOURS * 3600;
  const totalWidth = WINDOW_HOURS * HOUR_W;
  const nowX = ((nowBase - windowStart) / 60) * PX_PER_MIN;

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [byChannel, setByChannel] = useState<Map<string, EpgEntry[]>>(new Map());
  const [gridHeight, setGridHeight] = useState(0);

  const labelListRef = useRef<FlashListRef<Channel>>(null);
  const gridScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'live').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getChannels(profileId, selectedCategory, unlocked).then((rows) => {
      setChannels(rows);
      setLoaded(true);
      // Default the hero to the first channel; keep an existing pick otherwise.
      setSelectedChannel((cur) => cur ?? rows[0] ?? null);
    });
  }, [profileId, selectedCategory, unlocked]);

  useEffect(() => {
    if (!profileId) return;
    void epgRepo.getProgrammesInWindow(profileId, windowStart, windowEnd).then((rows) => {
      const map = new Map<string, EpgEntry[]>();
      for (const p of rows) {
        const list = map.get(p.epgChannelId);
        if (list) list.push(p);
        else map.set(p.epgChannelId, [p]);
      }
      setByChannel(map);
    });
  }, [profileId, windowStart, windowEnd]);

  function canCatchup(channel: Channel, p: EpgEntry): boolean {
    return (
      p.end <= nowBase &&
      channel.catchupDays != null &&
      p.start >= nowBase - channel.catchupDays * 86_400
    );
  }

  function playProgramme(channel: Channel, p: EpgEntry) {
    if (!provider) return;
    if (canCatchup(channel, p)) {
      router.push({
        pathname: '/player',
        params: {
          url: provider.buildCatchupUrl(channel.streamId, p.start, (p.end - p.start) / 60),
          title: p.title,
        },
      });
    } else {
      router.push({
        pathname: '/player',
        params: {
          url: provider.buildLiveUrl(channel.streamId),
          title: channel.name,
          itemId: channel.id,
          kind: 'live',
        },
      });
    }
  }

  function playLive(channel: Channel) {
    if (!provider) return;
    router.push({
      pathname: '/player',
      params: {
        url: provider.buildLiveUrl(channel.streamId),
        title: channel.name,
        itemId: channel.id,
        kind: 'live',
      },
    });
  }

  const onBodyScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    labelListRef.current?.scrollToOffset({
      offset: e.nativeEvent.contentOffset.y,
      animated: false,
    });
  };

  const jumpToNow = () => {
    gridScrollRef.current?.scrollTo({ x: Math.max(0, nowX - 80), animated: true });
  };

  const bodyHeight = Math.max(0, gridHeight - HEADER_H);

  const heroEntries = selectedChannel?.epgChannelId
    ? (byChannel.get(selectedChannel.epgChannelId) ?? [])
    : [];
  const { now: heroNow, next: heroNext } = findNowNext(heroEntries, nowBase);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: theme.space.lg, gap: theme.space.sm }}>
        <HeaderBar
          title={t('guide.title')}
          variant="display"
          right={
            <Pressable
              onPress={jumpToNow}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('live.now')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: theme.radius.pill,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}>
              <Feather name="disc" size={14} color={theme.colors.accent} />
              <AppText variant="caption" style={{ color: theme.colors.text }}>
                {t('live.now')}
              </AppText>
            </Pressable>
          }
        />
        <CategoryChips
          categories={categories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          accent={theme.colors.live}
        />
        {selectedChannel ? (
          <NowHero
            channel={selectedChannel}
            now={heroNow}
            next={heroNext}
            nowSecs={nowBase}
            onPress={() => playLive(selectedChannel)}
          />
        ) : !loaded ? (
          <Skeleton height={110} radius={theme.radius.lg} />
        ) : null}
      </View>

      {loaded && channels.length === 0 ? (
        <EmptyState icon="radio" title={t('live.noChannels')} />
      ) : (
        <View
          style={{ flex: 1, flexDirection: 'row', marginTop: theme.space.sm }}
          onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}>
          {/* Channel column (selectable) */}
          <View style={{ width: LABEL_W, borderRightWidth: 1, borderRightColor: theme.colors.border }}>
            <View
              style={{
                height: HEADER_H,
                justifyContent: 'center',
                paddingHorizontal: theme.space.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}>
              <AppText variant="caption" muted>
                {new Date(windowStart * 1000).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </AppText>
            </View>
            {bodyHeight > 0 ? (
              <FlashList
                ref={labelListRef}
                data={channels}
                scrollEnabled={false}
                keyExtractor={(c) => c.id}
                style={{ height: bodyHeight }}
                renderItem={({ item }) => {
                  const active = item.id === selectedChannel?.id;
                  return (
                    <Pressable
                      onPress={() => setSelectedChannel(item)}
                      style={{
                        height: ROW_H,
                        justifyContent: 'center',
                        paddingHorizontal: theme.space.sm,
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                        borderLeftWidth: 3,
                        borderLeftColor: active ? theme.colors.accent : 'transparent',
                        backgroundColor: active ? theme.colors.surface : 'transparent',
                      }}>
                      <AppText variant="caption" numberOfLines={2}>
                        {item.number ? `${item.number}. ` : ''}
                        {item.name}
                      </AppText>
                    </Pressable>
                  );
                }}
              />
            ) : null}
          </View>

          {/* Time axis + programme grid */}
          <ScrollView ref={gridScrollRef} horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: totalWidth, flex: 1 }}>
              <View style={{ flexDirection: 'row', height: HEADER_H }}>
                {Array.from({ length: WINDOW_HOURS }).map((_, h) => (
                  <View
                    key={h}
                    style={{
                      width: HOUR_W,
                      justifyContent: 'center',
                      paddingLeft: theme.space.sm,
                      borderBottomWidth: 1,
                      borderLeftWidth: 1,
                      borderColor: theme.colors.border,
                    }}>
                    <AppText variant="mono" muted>
                      {hhmm(windowStart + h * 3600)}
                    </AppText>
                  </View>
                ))}
              </View>

              {nowX >= 0 && nowX <= totalWidth ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: nowX,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    backgroundColor: theme.colors.accent,
                    zIndex: 2,
                  }}
                />
              ) : null}

              {bodyHeight > 0 ? (
                <FlashList
                  data={channels}
                  onScroll={onBodyScroll}
                  scrollEventThrottle={16}
                  keyExtractor={(c) => c.id}
                  style={{ height: bodyHeight, width: totalWidth }}
                  renderItem={({ item }) => (
                    <View
                      style={{
                        height: ROW_H,
                        width: totalWidth,
                        overflow: 'hidden',
                        borderBottomWidth: 1,
                        borderBottomColor: theme.colors.border,
                      }}>
                      {(byChannel.get(item.epgChannelId ?? '') ?? []).map((p) => {
                        const left = ((p.start - windowStart) / 60) * PX_PER_MIN;
                        const width = ((p.end - p.start) / 60) * PX_PER_MIN - 2;
                        if (width <= 0) return null;
                        const replay = canCatchup(item, p);
                        const current = p.start <= nowBase && nowBase < p.end;
                        return (
                          <Pressable
                            key={p.id}
                            onPress={() => playProgramme(item, p)}
                            style={{
                              position: 'absolute',
                              left,
                              width,
                              top: 4,
                              bottom: 4,
                              backgroundColor: current
                                ? theme.colors.surfaceElevated
                                : theme.colors.surface,
                              borderRadius: theme.radius.sm,
                              borderWidth: 1,
                              borderColor: current
                                ? theme.colors.accent
                                : replay
                                  ? theme.colors.accentMuted
                                  : theme.colors.border,
                              padding: theme.space.xs,
                              justifyContent: 'center',
                            }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {replay ? (
                                <Feather
                                  name="rotate-ccw"
                                  size={11}
                                  color={theme.colors.accent}
                                />
                              ) : null}
                              <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                                {p.title}
                              </AppText>
                            </View>
                            <AppText variant="mono" muted numberOfLines={1}>
                              {hhmm(p.start)}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      )}
    </Screen>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/guide.tsx
git commit -m "feat(guide): En ce moment hero + selectable channels, jump-to-now, current-cell highlight, catch-up icon, states"
```

---

### Task 4: Manual verification on the emulator

**Files:** none (commit only if fixes needed).

- [ ] **Step 1: Reload the app**, open the Guide (Live → Guide button).
- [ ] **Step 2: Hero** — the first channel's current programme shows (or "Pas de programme en cours."); progress bar reflects elapsed; "À SUIVRE" shows the next title.
- [ ] **Step 3: Selection** — tap another channel name in the left column → the active row highlights (gold left-border) and the hero updates.
- [ ] **Step 4: Jump to now** — scroll the grid sideways, tap the "Maintenant" pill → grid scrolls back to the now-line.
- [ ] **Step 5: Current cell** — the programme airing now has an accent border; tap it → plays live. Tap the hero → plays live.
- [ ] **Step 6: States** — with no channels in a category, the EmptyState shows.
- [ ] **Step 7:** `npm run typecheck && npm run lint && npm test` → all green. Commit any fixes.

## Self-Review

- **Spec coverage:** NowHero (Task 2) using findNowNext (Task 1); hero above kept grid, selectable channel column, jump-to-now, current-cell highlight, Feather catch-up icon, loading skeleton + EmptyState (Task 3). All spec sections covered.
- **Placeholder scan:** none — full code in every step.
- **Type consistency:** `findNowNext(entries, nowSecs)` identical in Task 1/3; `NowHero` props (`channel,now,next,nowSecs,onPress`) match definition and Task 3 usage; `nowBase` passed as `nowSecs` (no render-time `Date.now()`); category state renamed to `selectedCategory` to free `selectedChannel`.
