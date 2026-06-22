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
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                              }}>
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
