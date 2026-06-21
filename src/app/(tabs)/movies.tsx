import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { catalogRepo, progressRepo } from '@/data';
import type { Category, Movie } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, FavoriteButton, PosterCard, Screen } from '@/ui/components';

const COLUMNS = 3;

interface ResumeItem {
  key: string;
  title: string;
  posterUrl: string | null;
  url: string;
  itemId: string;
  kind: 'movie' | 'series';
  progress: number;
}

export default function MoviesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [resume, setResume] = useState<ResumeItem[]>([]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'movie').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getMovies(profileId, selected).then(setMovies);
  }, [profileId, selected]);

  const refreshResume = useCallback(async () => {
    if (!profileId || !provider) return;
    const rows = await progressRepo.getContinueWatching(profileId);
    const items = await Promise.all(
      rows.map(async (r): Promise<ResumeItem | null> => {
        const ratio = r.durationSecs ? r.positionSecs / r.durationSecs : 0;
        if (r.kind === 'movie') {
          const m = await catalogRepo.getMovieById(r.itemId);
          if (!m) return null;
          return {
            key: r.itemId,
            title: m.name,
            posterUrl: m.posterUrl,
            url: provider.buildMovieUrl(m.streamId, m.containerExt),
            itemId: m.id,
            kind: 'movie',
            progress: ratio,
          };
        }
        const e = await catalogRepo.getEpisodeById(r.itemId);
        if (!e) return null;
        return {
          key: r.itemId,
          title: e.title,
          posterUrl: null,
          url: provider.buildEpisodeUrl(e.streamId, e.containerExt),
          itemId: e.id,
          kind: 'series',
          progress: ratio,
        };
      }),
    );
    setResume(items.filter((i): i is ResumeItem => i !== null));
  }, [profileId, provider]);

  useFocusEffect(
    useCallback(() => {
      void refreshResume();
    }, [refreshResume]),
  );

  const gap = theme.space.md;
  const tileWidth = (width - theme.space.lg * 2 - gap * (COLUMNS - 1)) / COLUMNS;

  const Header = (
    <View>
      <AppText variant="display" style={{ paddingTop: theme.space.lg }}>
        {t('tabs.movies')}
      </AppText>

      {resume.length > 0 ? (
        <View style={{ gap: theme.space.sm, marginTop: theme.space.md }}>
          <AppText variant="heading">{t('catalog.resume')}</AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.space.md }}>
            {resume.map((item) => (
              <PosterCard
                key={item.key}
                title={item.title}
                posterUrl={item.posterUrl}
                width={120}
                progress={item.progress}
                onPress={() =>
                  router.push({
                    pathname: '/player',
                    params: {
                      url: item.url,
                      title: item.title,
                      itemId: item.itemId,
                      kind: item.kind,
                    },
                  })
                }
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.space.sm, paddingVertical: theme.space.md }}>
        <Chip
          label={t('common.all')}
          selected={selected === undefined}
          accent={theme.colors.movies}
          onPress={() => setSelected(undefined)}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            label={c.name}
            selected={selected === c.id}
            accent={theme.colors.movies}
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
          data={movies}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={Header}
          ListEmptyComponent={
            <AppText variant="body" muted style={{ padding: theme.space.lg }}>
              {categories.length === 0 ? t('catalog.notSupported') : t('catalog.noItems')}
            </AppText>
          }
          renderItem={({ item }) => (
            <View style={{ paddingRight: gap, paddingBottom: gap }}>
              <PosterCard
                title={item.name}
                posterUrl={item.posterUrl}
                subtitle={item.year ? String(item.year) : null}
                width={tileWidth}
                topRight={
                  <FavoriteButton
                    profileId={profileId}
                    itemId={item.id}
                    kind="movie"
                    overlay
                    size={14}
                  />
                }
                onPress={() => {
                  if (!provider) return;
                  router.push({
                    pathname: '/player',
                    params: {
                      url: provider.buildMovieUrl(item.streamId, item.containerExt),
                      title: item.name,
                      itemId: item.id,
                      kind: 'movie',
                    },
                  });
                }}
              />
            </View>
          )}
        />
      </View>
    </Screen>
  );
}
