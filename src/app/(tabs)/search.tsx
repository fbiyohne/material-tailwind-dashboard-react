import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { catalogRepo, epgRepo, searchRepo } from '@/data';
import type { ProgrammeHit } from '@/data/repositories/epgRepository';
import type { SearchHit } from '@/data/repositories/searchRepository';
import { parseNlQuery } from '@/services/nlSearch';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, ListRow, Screen, TextField } from '@/ui/components';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function SearchScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [query, setQuery] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [mode, setMode] = useState<'catalog' | 'epg'>('catalog');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeHit[]>([]);

  // Debounced natural-language search. All setState lives inside the async
  // callback to keep the effect body side-effect-free (React 19 rule).
  useEffect(() => {
    if (!profileId) return;
    const handle = setTimeout(() => {
      if (query.trim().length < 2) {
        setHits([]);
        setProgrammes([]);
        setLabels([]);
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const q = parseNlQuery(query, now);
      setLabels(q.labels);
      if (q.epg) {
        const from = q.window?.from ?? now;
        const to = q.window?.to ?? now + 6 * 3600;
        setMode('epg');
        void epgRepo.searchProgrammes(profileId, q.keywords, from, to).then(setProgrammes);
      } else {
        setMode('catalog');
        const text = q.keywords.length > 0 ? q.keywords.join(' ') : query;
        void searchRepo.searchCatalog(profileId, text).then((all) => {
          setHits(q.kind ? all.filter((h) => h.kind === q.kind) : all);
        });
      }
    }, 250);
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
          params: { seriesId: s.seriesId, name: s.name, id: s.id },
        });
      }
    }
  }

  function openProgramme(p: ProgrammeHit) {
    if (!provider) return;
    router.push({
      pathname: '/player',
      params: {
        url: provider.buildLiveUrl(p.streamId),
        title: p.channelName,
        itemId: p.channelId,
        kind: 'live',
      },
    });
  }

  const kindLabel = (kind: SearchHit['kind']) =>
    kind === 'live' ? t('tabs.live') : kind === 'movie' ? t('tabs.movies') : t('tabs.series');

  const empty = mode === 'epg' ? programmes.length === 0 : hits.length === 0;

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

        {labels.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
            {labels.map((l) => (
              <Chip key={l} label={l} selected accent={theme.colors.accent} />
            ))}
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          {empty ? (
            <AppText variant="body" muted style={{ paddingVertical: theme.space.md }}>
              {query.trim().length >= 2 ? t('search.noResults') : t('search.hint')}
            </AppText>
          ) : mode === 'epg' ? (
            <FlashList
              data={programmes}
              keyExtractor={(item, i) => `${item.channelId}-${item.start}-${i}`}
              renderItem={({ item }) => (
                <ListRow
                  title={item.title}
                  subtitle={`${hhmm(item.start)} · ${item.channelName}`}
                  imageUrl={item.logoUrl}
                  onPress={() => openProgramme(item)}
                />
              )}
            />
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
