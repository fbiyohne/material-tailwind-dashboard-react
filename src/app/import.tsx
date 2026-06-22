import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { importCatalog, type SyncProgress } from '@/sync';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, ProgressBar, Screen } from '@/ui/components';

const PHASE_KEYS: Record<SyncProgress['phase'], string> = {
  authenticating: 'importing.authenticating',
  live: 'importing.live',
  vod: 'importing.vod',
  series: 'importing.series',
  epg: 'importing.epg',
  indexing: 'importing.indexing',
  done: 'importing.done',
  error: 'importing.error',
};

export default function ImportScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const provider = useSessionStore((s) => s.provider);
  const refreshProfiles = useSessionStore((s) => s.refreshProfiles);

  const [progress, setProgress] = useState<SyncProgress>({
    phase: 'authenticating',
    progress: 0,
  });
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!provider) {
      router.replace('/onboarding');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;

    importCatalog(provider, {
      signal: controller.signal,
      onProgress: setProgress,
    })
      .then(async () => {
        await refreshProfiles();
        router.replace('/live');
      })
      .catch((e: unknown) => {
        setFailed(e instanceof Error ? e.message : String(e));
      });

    return () => controller.abort();
  }, [provider, attempt, router, refreshProfiles]);

  const label = t(PHASE_KEYS[progress.phase]);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
        <AppText variant="display">{t('importing.title')}</AppText>

        <Card elevated>
          <AppText variant="heading">{failed ? t('importing.error') : label}</AppText>

          <View style={{ marginVertical: theme.space.sm }}>
            <ProgressBar
              progress={progress.progress}
              showPercent={!failed}
              error={!!failed}
            />
          </View>

          {failed ? (
            <AppText variant="caption" color="danger">
              {failed}
            </AppText>
          ) : progress.detail ? (
            <AppText variant="caption" muted>
              {progress.detail}
            </AppText>
          ) : null}
        </Card>

        {failed ? (
          <Button
            title={t('common.retry')}
            fullWidth
            onPress={() => {
              setFailed(null);
              setAttempt((a) => a + 1);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
