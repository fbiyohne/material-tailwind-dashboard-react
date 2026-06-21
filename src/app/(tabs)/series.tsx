import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';
import { catalogRepo } from '@/data';
import type { Category, Series } from '@/domain/models';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import {
  AppText,
  CategoryChips,
  FavoriteButton,
  PosterCard,
  Screen,
} from '@/ui/components';

const COLUMNS = 3;

export default function SeriesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const unlocked = useParentalStore((s) => s.unlocked);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getCategories(profileId, 'series').then(setCategories);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo.getSeries(profileId, selected, unlocked).then(setSeries);
  }, [profileId, selected, unlocked]);

  const gap = theme.space.md;
  const tileWidth = (width - theme.space.lg * 2 - gap * (COLUMNS - 1)) / COLUMNS;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ paddingHorizontal: theme.space.xl, paddingTop: theme.space.lg }}>
        <AppText variant="display">{t('tabs.series')}</AppText>
      </View>

      <View style={{ paddingHorizontal: theme.space.lg }}>
        <CategoryChips
          categories={categories}
          selected={selected}
          onSelect={setSelected}
          accent={theme.colors.series}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
        {series.length === 0 ? (
          <AppText variant="body" muted style={{ padding: theme.space.lg }}>
            {categories.length === 0 ? t('catalog.notSupported') : t('catalog.noItems')}
          </AppText>
        ) : (
          <FlashList
            data={series}
            numColumns={COLUMNS}
            keyExtractor={(item) => item.id}
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
                      kind="series"
                      overlay
                      size={14}
                    />
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/series-detail',
                      params: { seriesId: item.seriesId, name: item.name, id: item.id },
                    })
                  }
                />
              </View>
            )}
          />
        )}
      </View>
    </Screen>
  );
}
