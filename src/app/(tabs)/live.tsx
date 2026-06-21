import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { catalogRepo, epgRepo, favoritesRepo, progressRepo } from '@/data';
import type { Category, Channel } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, FavoriteButton, ListRow, Screen } from '@/ui/components';

export default function LiveScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recent, setRecent] = useState<Channel[]>([]);
  const [favorites, setFavorites] = useState<Channel[]>([]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'live').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getChannels(profileId, selected).then(setChannels);
  }, [profileId, selected]);

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
      void refreshShelves();
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

  const Header = (
    <View>
      <AppText variant="display" style={{ paddingTop: theme.space.lg }}>
        {t('live.title')}
      </AppText>

      {recent.length > 0 ? (
        <ChannelShelf title={t('live.recents')} channels={recent} onPress={openChannel} />
      ) : null}
      {favorites.length > 0 ? (
        <ChannelShelf title={t('live.favorites')} channels={favorites} onPress={openChannel} />
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.sm, paddingVertical: theme.space.md }}>
        <Chip
          label={t('common.all')}
          selected={selected === undefined}
          accent={theme.colors.live}
          onPress={() => setSelected(undefined)}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={selected === c.id}
            accent={theme.colors.live}
            onPress={() => setSelected(c.id)}
          />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
        <FlashList
          data={channels}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <AppText variant="body" muted style={{ padding: theme.space.lg }}>
              {t('live.noChannels')}
            </AppText>
          }
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              profileId={profileId}
              onPress={() => openChannel(item)}
            />
          )}
        />
      </View>
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
    <View style={{ gap: theme.space.sm, marginTop: theme.space.md }}>
      <AppText variant="heading">{title}</AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.md }}>
        {channels.map((c) => (
          <Pressable key={c.id} onPress={() => onPress(c)} style={{ width: 92 }}>
            <View
              style={{
                width: 92,
                height: 64,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
              {c.logoUrl ? (
                <Image
                  source={{ uri: c.logoUrl }}
                  style={{ width: '80%', height: '80%' }}
                  contentFit="contain"
                />
              ) : (
                <AppText variant="caption" muted>
                  {c.number ? String(c.number) : '—'}
                </AppText>
              )}
            </View>
            <AppText variant="caption" numberOfLines={1} style={{ marginTop: theme.space.xs }}>
              {c.name}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function ChannelRow({
  channel,
  profileId,
  onPress,
}: {
  channel: Channel;
  profileId: string | null;
  onPress: () => void;
}) {
  const { t } = useTranslation();
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

  return (
    <ListRow
      title={channel.name}
      subtitle={nowTitle ? `${t('live.now')} · ${nowTitle}` : null}
      imageUrl={channel.logoUrl}
      leadingBadge={channel.number ? String(channel.number) : null}
      onPress={onPress}
      trailing={<FavoriteButton profileId={profileId} itemId={channel.id} kind="live" />}
    />
  );
}
