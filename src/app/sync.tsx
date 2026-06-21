import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { getLocale } from '@/data/kv/settings';
import i18n from '@/i18n';
import {
  exportSnapshotToCloud,
  importSnapshotFromCloud,
  type RestoreSummary,
} from '@/services';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useThemeStore } from '@/state/themeStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Screen } from '@/ui/components';

type Busy = 'export' | 'import' | null;

export default function SyncScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const [busy, setBusy] = useState<Busy>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy('export');
    setResult(null);
    setError(null);
    try {
      await exportSnapshotToCloud();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onImport() {
    setBusy('import');
    setResult(null);
    setError(null);
    try {
      const summary: RestoreSummary | null = await importSnapshotFromCloud();
      if (!summary) return; // cancelled
      // Re-hydrate everything the snapshot touched.
      useThemeStore.getState().hydrate();
      useParentalStore.getState().hydrate();
      const loc = getLocale();
      if (loc) await i18n.changeLanguage(loc);
      const session = useSessionStore.getState();
      await session.refreshProfiles();
      const refreshed = useSessionStore.getState();
      if (!refreshed.activeProfileId && refreshed.profiles[0]) {
        await refreshed.switchProfile(refreshed.profiles[0].id);
      }
      setResult(
        t('sync.imported', {
          profiles: summary.profiles,
          favorites: summary.favorites,
          progress: summary.progress,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <AppText variant="heading">‹</AppText>
          </Pressable>
          <AppText variant="display" style={{ flex: 1 }}>
            {t('sync.title')}
          </AppText>
        </View>

        <AppText variant="caption" muted>
          {t('sync.intro')}
        </AppText>

        <Card>
          <AppText variant="caption" color="danger">
            {t('sync.warning')}
          </AppText>
        </Card>

        {result ? (
          <AppText variant="body" color="success">
            {result}
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="body" color="danger">
            {error}
          </AppText>
        ) : null}

        <Button
          title={t('sync.export')}
          loading={busy === 'export'}
          disabled={busy !== null}
          onPress={() => void onExport()}
        />
        <Button
          title={t('sync.import')}
          variant="secondary"
          loading={busy === 'import'}
          disabled={busy !== null}
          onPress={() => void onImport()}
        />
      </ScrollView>
    </Screen>
  );
}
