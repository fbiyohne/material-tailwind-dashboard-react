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
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, CategoryChips, Screen } from '@/ui/components';

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

  // Capture the mount time once; the window is derived purely from it.
  const [nowBase] = useState(() => Math.floor(Date.now() / 1000));
  const windowStart = Math.floor(nowBase / 1800) * 1800 - 3600; // snap to half hour, -1h
  const windowEnd = windowStart + WINDOW_HOURS * 3600;
  const totalWidth = WINDOW_HOURS * HOUR_W;
  const nowX = ((nowBase - windowStart) / 60) * PX_PER_MIN;

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [byChannel, setByChannel] = useState<Map<string, EpgEntry[]>>(new Map());
  const [gridHeight, setGridHeight] = useState(0);

  const labelListRef = useRef<FlashListRef<Channel>>(null);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'live').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getChannels(profileId, selected, unlocked).then(setChannels);
  }, [profileId, selected, unlocked]);

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

  function play(channel: Channel) {
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

  // Body vertical scroll drives the (non-interactive) label column.
  const onBodyScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    labelListRef.current?.scrollToOffset({
      offset: e.nativeEvent.contentOffset.y,
      animated: false,
    });
  };

  const bodyHeight = Math.max(0, gridHeight - HEADER_H);

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: theme.space.lg, gap: theme.space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText variant="heading">‹</AppText>
          </Pressable>
          <AppText variant="display" style={{ flex: 1 }}>
            {t('guide.title')}
          </AppText>
        </View>
        <CategoryChips
          categories={categories}
          selected={selected}
          onSelect={setSelected}
          accent={theme.colors.live}
        />
      </View>

      <View
        style={{ flex: 1, flexDirection: 'row' }}
        onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}>
        {/* Channel column (vertical, driven by the grid) */}
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
              renderItem={({ item }) => (
                <View
                  style={{
                    height: ROW_H,
                    justifyContent: 'center',
                    paddingHorizontal: theme.space.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}>
                  <AppText variant="caption" numberOfLines={2}>
                    {item.number ? `${item.number}. ` : ''}
                    {item.name}
                  </AppText>
                </View>
              )}
            />
          ) : null}
        </View>

        {/* Time axis + programme grid (shared horizontal scroll) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: totalWidth, flex: 1 }}>
            {/* Time header */}
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

            {/* Now line spanning header + body */}
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
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => play(item)}
                          style={{
                            position: 'absolute',
                            left,
                            width,
                            top: 4,
                            bottom: 4,
                            backgroundColor: theme.colors.surface,
                            borderRadius: theme.radius.sm,
                            borderWidth: 1,
                            borderColor: theme.colors.border,
                            padding: theme.space.xs,
                            justifyContent: 'center',
                          }}>
                          <AppText variant="caption" numberOfLines={1}>
                            {p.title}
                          </AppText>
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
    </Screen>
  );
}
