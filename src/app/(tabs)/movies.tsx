import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { catalogRepo } from '@/data';
import type { Category, Movie } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, PosterCard, Screen } from '@/ui/components';

const COLUMNS = 3;

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

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'movie').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getMovies(profileId, selected).then(setMovies);
  }, [profileId, selected]);

  const gap = theme.space.md;
  const tileWidth = (width - theme.space.lg * 2 - gap * (COLUMNS - 1)) / COLUMNS;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg }}>
        <AppText variant="display">{t('tabs.movies')}</AppText>
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

      <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
        {movies.length === 0 ? (
          <AppText variant="body" muted style={{ padding: theme.space.lg }}>
            {categories.length === 0 ? t('catalog.notSupported') : t('catalog.noItems')}
          </AppText>
        ) : (
          <FlashList
            data={movies}
            numColumns={COLUMNS}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={{ paddingRight: gap, paddingBottom: gap }}>
                <PosterCard
                  title={item.name}
                  posterUrl={item.posterUrl}
                  subtitle={item.year ? String(item.year) : null}
                  width={tileWidth}
                  onPress={() => {
                    if (!provider) return;
                    const url = provider.buildMovieUrl(item.streamId, item.containerExt);
                    router.push({ pathname: '/player', params: { url, title: item.name } });
                  }}
                />
              </View>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
