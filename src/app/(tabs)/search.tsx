import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { catalogRepo, searchRepo } from '@/data';
import type { SearchHit } from '@/data/repositories/searchRepository';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, ListRow, Screen, TextField } from '@/ui/components';

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);

  // Debounced FTS search. All setState happens inside the async callback so the
  // effect body stays side-effect-free (React 19 set-state-in-effect rule).
  useEffect(() => {
    if (!profileId) return;
    const q = query.trim();
    const handle = setTimeout(() => {
      if (q.length < 2) {
        setHits([]);
        return;
      }
      void searchRepo.searchCatalog(profileId, q).then(setHits);
    }, 200);
    return () => clearTimeout(handle);
  }, [profileId, query]);

  async function openHit(hit: SearchHit) {
    if (!provider) return;
    if (hit.kind === 'live') {
      const channel = await catalogRepo.getChannelById(hit.refId);
      if (channel) {
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
    } else if (hit.kind === 'movie') {
      const movie = await catalogRepo.getMovieById(hit.refId);
      if (movie) {
        router.push({
          pathname: '/player',
          params: {
            url: provider.buildMovieUrl(movie.streamId, movie.containerExt),
            title: movie.name,
            itemId: movie.id,
            kind: 'movie',
          },
        });
      }
    } else {
      const s = await catalogRepo.getSeriesById(hit.refId);
      if (s) {
        router.push({
          pathname: '/series-detail',
          params: { seriesId: s.seriesId, name: s.name },
        });
      }
    }
  }

  const kindLabel = (kind: SearchHit['kind']) =>
    kind === 'live' ? t('tabs.live') : kind === 'movie' ? t('tabs.movies') : t('tabs.series');

  return (
    <Screen edges={['top']}>
      <View style={{ gap: theme.space.md, flex: 1 }}>
        <AppText variant="display">{t('tabs.search')}</AppText>
        <TextField
          label={t('common.search')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={{ flex: 1 }}>
          {hits.length === 0 ? (
            <AppText variant="body" muted style={{ paddingVertical: theme.space.md }}>
              {query.trim().length >= 2 ? t('search.noResults') : t('search.hint')}
            </AppText>
          ) : (
            <FlashList
              data={hits}
              keyExtractor={(item) => item.refId}
              renderItem={({ item }) => (
                <ListRow
                  title={item.name}
                  subtitle={kindLabel(item.kind)}
                  leadingBadge={kindLabel(item.kind).charAt(0)}
                  onPress={() => void openHit(item)}
                />
              )}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
