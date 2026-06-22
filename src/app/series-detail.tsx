import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import type { SeriesDetail } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import {
  AppText,
  Card,
  EmptyState,
  FavoriteButton,
  HeaderBar,
  ListRow,
  Screen,
  Skeleton,
} from '@/ui/components';

export default function SeriesDetailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const provider = useSessionStore((s) => s.provider);
  const profileId = useSessionStore((s) => s.activeProfileId);
  const { seriesId, name, id } = useLocalSearchParams<{
    seriesId: string;
    name?: string;
    id?: string;
  }>();

  const [detail, setDetail] = useState<SeriesDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!provider || !seriesId) return;
    provider
      .getSeriesInfo(seriesId)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provider, seriesId]);

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <HeaderBar
          title={name ?? ''}
          variant="display"
          right={
            id ? (
              <FavoriteButton profileId={profileId} itemId={id} kind="series" size={24} />
            ) : undefined
          }
        />

        {loading ? (
          <View style={{ gap: theme.space.md }}>
            <Skeleton width={130} height={22} />
            <Card>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  height={40}
                  style={{ marginBottom: i < 3 ? theme.space.sm : 0 }}
                />
              ))}
            </Card>
          </View>
        ) : detail && detail.seasons.length > 0 ? (
          detail.seasons.map((season) => (
            <View key={season.season} style={{ gap: theme.space.sm }}>
              <AppText variant="heading">
                {t('seriesDetail.season', { n: season.season })}
              </AppText>
              <Card>
                {season.episodes.map((ep) => (
                  <ListRow
                    key={ep.id}
                    title={ep.title}
                    leadingBadge={String(ep.episode)}
                    onPress={() => {
                      if (!provider) return;
                      const url = provider.buildEpisodeUrl(ep.streamId, ep.containerExt);
                      router.push({
                        pathname: '/player',
                        params: { url, title: ep.title, itemId: ep.id, kind: 'series' },
                      });
                    }}
                  />
                ))}
              </Card>
            </View>
          ))
        ) : (
          <EmptyState icon="film" title={t('catalog.noItems')} />
        )}
      </ScrollView>
    </Screen>
  );
}
