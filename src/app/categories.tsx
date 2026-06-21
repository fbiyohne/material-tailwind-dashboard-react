import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { catalogRepo } from '@/data';
import type { Category, StreamKind } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Chip, Screen } from '@/ui/components';

const KINDS: readonly StreamKind[] = ['live', 'movie', 'series'];

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);

  const [kind, setKind] = useState<StreamKind>('live');
  const [cats, setCats] = useState<Category[]>([]);

  const reload = useCallback(() => {
    if (!profileId) return;
    void catalogRepo
      .getCategories(profileId, kind, { includeHidden: true })
      .then(setCats);
  }, [profileId, kind]);

  useEffect(() => {
    if (!profileId) return;
    void catalogRepo
      .getCategories(profileId, kind, { includeHidden: true })
      .then(setCats);
  }, [profileId, kind]);

  async function toggle(c: Category, field: 'isHidden' | 'isLocked' | 'isPinned') {
    await catalogRepo.updateCategoryCuration(c.id, { [field]: !c[field] });
    reload();
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= cats.length) return;
    const next = [...cats];
    [next[index], next[target]] = [next[target], next[index]];
    setCats(next);
    // Persist the new positions as a contiguous order.
    await Promise.all(
      next.map((c, i) => catalogRepo.updateCategoryCuration(c.id, { sortOrder: i })),
    );
  }

  const kindLabel = (k: StreamKind) =>
    k === 'live' ? t('tabs.live') : k === 'movie' ? t('tabs.movies') : t('tabs.series');

  return (
    <Screen padded={false} edges={['top']}>
      <View style={{ padding: theme.space.lg, gap: theme.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText variant="heading">‹</AppText>
          </Pressable>
          <AppText variant="display" style={{ flex: 1 }}>
            {t('categories.title')}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          {KINDS.map((k) => (
            <Chip
              key={k}
              label={kindLabel(k)}
              selected={k === kind}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: theme.space.lg }}>
        <FlashList
          data={cats}
          extraData={cats}
          keyExtractor={(c) => c.id}
          renderItem={({ item, index }) => (
            <View
              style={{
                paddingVertical: theme.space.sm,
                gap: theme.space.sm,
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" numberOfLines={1}>
                    {item.name}
                  </AppText>
                </View>
                <Pressable onPress={() => move(index, -1)} hitSlop={6}>
                  <AppText variant="heading" muted>
                    ↑
                  </AppText>
                </Pressable>
                <Pressable onPress={() => move(index, 1)} hitSlop={6}>
                  <AppText variant="heading" muted>
                    ↓
                  </AppText>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
                <Chip
                  label={t('categories.pin')}
                  selected={item.isPinned}
                  onPress={() => void toggle(item, 'isPinned')}
                />
                <Chip
                  label={t('categories.hide')}
                  selected={item.isHidden}
                  onPress={() => void toggle(item, 'isHidden')}
                />
                <Chip
                  label={t('categories.lock')}
                  selected={item.isLocked}
                  accent={theme.colors.danger}
                  onPress={() => void toggle(item, 'isLocked')}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <AppText variant="body" muted style={{ padding: theme.space.lg }}>
              {t('catalog.noItems')}
            </AppText>
          }
        />
      </View>
    </Screen>
  );
}
