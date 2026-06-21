import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { catalogRepo, epgRepo } from '@/data';
import type { Category, Channel } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, ListRow, Screen } from '@/ui/components';

export default function LiveScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'live').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getChannels(profileId, selected).then(setChannels);
  }, [profileId, selected]);

  const openChannel = useCallback(
    (channel: Channel) => {
      if (!provider) return;
      const url = provider.buildLiveUrl(channel.streamId);
      router.push({ pathname: '/player', params: { url, title: channel.name } });
    },
    [provider, router],
  );

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg }}>
        <AppText variant="display">{t('live.title')}</AppText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: theme.space.sm,
          paddingHorizontal: theme.space.xl,
          paddingVertical: theme.space.md,
        }}>
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

      <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
        {channels.length === 0 ? (
          <AppText variant="body" muted style={{ padding: theme.space.lg }}>
            {t('live.noChannels')}
          </AppText>
        ) : (
          <FlashList
            data={channels}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChannelRow
                channel={item}
                profileId={profileId}
                onPress={() => openChannel(item)}
              />
            )}
          />
        )}
      </View>
    </Screen>
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
    />
  );
}
