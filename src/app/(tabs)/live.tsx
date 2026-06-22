import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { catalogRepo, epgRepo, favoritesRepo, progressRepo } from '@/data';
import type { Category, Channel } from '@/domain/models';
import { isTV } from '@/lib/tv';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import {
  AppText,
  Button,
  Card,
  CategoryChips,
  EmptyState,
  FavoriteButton,
  ListRow,
  LivePreview,
  NowNextStrip,
  Screen,
  TextField,
} from '@/ui/components';

export default function LiveScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWide = width > height;
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);
  const unlocked = useParentalStore((s) => s.unlocked);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recent, setRecent] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Channel[]>([]);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState('');

  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPaused, setPreviewPaused] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'live').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getChannels(profileId, selectedCategory, unlocked).then(setChannels);
  }, [profileId, selectedCategory, unlocked]);

  // Debounce the preview source so fast zapping doesn't reload on every tap.
  useEffect(() => {
    if (!selectedChannel || !provider) return;
    const channel = selectedChannel;
    const id = setTimeout(() => {
      setPreviewUrl(provider.buildLiveUrl(channel.streamId));
    }, 400);
    return () => clearTimeout(id);
  }, [selectedChannel, provider]);

  // Refresh recents/favorites every time the screen regains focus.
  const refreshShelves = useCallback(async () => {
    if (!profileId) return;
    const recentIds = await progressRepo.getRecentChannelIds(profileId, 12);
    const recents = await Promise.all(recentIds.map((id) => catalogRepo.getChannelById(id)));
    setRecent(recents.filter((c): c is Channel => c !== null));

    const favRefs = await favoritesRepo.listFavorites(profileId, 'live');
    const favs = await Promise.all(favRefs.map((f) => catalogRepo.getChannelById(f.itemId)));
    setFavorites(favs.filter((c): c is Channel => c !== null));
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      setPreviewPaused(false);
      void refreshShelves();
      return () => setPreviewPaused(true);
    }, [refreshShelves]),
  );

  const openChannel = useCallback(
    (channel: Channel) => {
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
    },
    [provider, router],
  );

  function doJump() {
    const n = Number.parseInt(jumpValue, 10);
    const match = channels.find((c) => c.number === n);
    if (match) openChannel(match);
    setJumpOpen(false);
    setJumpValue('');
  }

  const renderChannel = ({ item }: { item: Channel }) => (
    <ChannelRow
      channel={item}
      profileId={profileId}
      onPress={() => setSelectedChannel(item)}
      onLongPress={() => openChannel(item)}
    />
  );

  const previewBlock = (
    <View style={{ gap: theme.space.xs }}>
      <LivePreview
        channel={selectedChannel}
        streamUrl={previewUrl}
        paused={previewPaused}
        onFullscreen={() => selectedChannel && openChannel(selectedChannel)}
      />
      <NowNextStrip profileId={profileId} channel={selectedChannel} />
    </View>
  );

  const Header = (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: theme.space.lg,
          gap: theme.space.sm,
        }}>
        <AppText variant="display">{t('live.title')}</AppText>
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          {isTV ? (
            <Button title={t('tv.jump')} variant="ghost" onPress={() => setJumpOpen((o) => !o)} />
          ) : null}
          <Button title={t('guide.title')} variant="ghost" onPress={() => router.push('/guide')} />
        </View>
      </View>

      {jumpOpen ? (
        <Card style={{ marginTop: theme.space.sm }}>
          <TextField
            label={t('tv.jump')}
            value={jumpValue}
            onChangeText={setJumpValue}
            keyboardType="number-pad"
            placeholder={t('tv.jumpPlaceholder')}
            autoFocus
            onSubmitEditing={doJump}
          />
          <Button title={t('common.search')} onPress={doJump} hasTVPreferredFocus />
        </Card>
      ) : null}

      {recent.length > 0 ? (
        <ChannelShelf title={t('live.recents')} channels={recent} onPress={setSelectedChannel} />
      ) : null}
      {favorites.length > 0 ? (
        <ChannelShelf
          title={t('live.favorites')}
          channels={favorites}
          onPress={setSelectedChannel}
        />
      ) : null}

      <CategoryChips
        categories={categories}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        accent={theme.colors.live}
      />
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
              renderItem={renderChannel}
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
            renderItem={renderChannel}
          />
        </View>
      )}
    </Screen>
  );
}

function ChannelShelf({
  title,
  channels,
  onPress,
}: {
  title: string;
  channels: Channel[];
  onPress: (c: Channel) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm, marginTop: theme.space.lg }}>
      <AppText variant="heading">{title}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.md, paddingVertical: 2 }}>
        {channels.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => onPress(c)}
            style={({ pressed }) => ({ width: 108, opacity: pressed ? 0.85 : 1 })}>
            <View
              style={[
                {
                  width: 108,
                  height: 72,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surface,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: theme.space.sm,
                },
                theme.shadow.card,
              ]}>
              {c.logoUrl ? (
                <Image
                  source={{ uri: c.logoUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              ) : (
                <AppText variant="title" muted style={{ fontSize: 22 }}>
                  {c.number ? String(c.number) : '—'}
                </AppText>
              )}
            </View>
            <AppText
              variant="caption"
              numberOfLines={1}
              style={{ marginTop: theme.space.xs + 2, color: theme.colors.text }}>
              {c.name}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Pull a trailing quality tag — "(1080p)", "FHD", "4K"… — off the channel name. */
function splitQuality(name: string): { title: string; quality: string | null } {
  const m = name.match(/\s*[([]?\b(\d{3,4}p|U?FHD|UHD|HD|SD|4K)\b[)\]]?\s*$/i);
  if (m) {
    return { title: name.slice(0, m.index).trim() || name, quality: m[1].toUpperCase() };
  }
  return { title: name, quality: null };
}

function ChannelRow({
  channel,
  profileId,
  onPress,
  onLongPress,
}: {
  channel: Channel;
  profileId: string | null;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [nowTitle, setNowTitle] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (profileId && channel.epgChannelId) {
      void epgRepo
        .getNowNext(profileId, channel.epgChannelId)
        .then((nn) => {
          if (active) setNowTitle(nn.now?.title ?? null);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [profileId, channel.epgChannelId]);

  const { title, quality } = splitQuality(channel.name);

  return (
    <ListRow
      title={title}
      subtitle={nowTitle ? `${t('live.now')} · ${nowTitle}` : null}
      dotColor={nowTitle ? theme.colors.live : null}
      imageUrl={channel.logoUrl}
      leadingBadge={channel.number ? String(channel.number) : null}
      badge={quality}
      onPress={onPress}
      onLongPress={onLongPress}
      trailing={<FavoriteButton profileId={profileId} itemId={channel.id} kind="live" />}
    />
  );
}
