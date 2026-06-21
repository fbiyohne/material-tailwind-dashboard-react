import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { getTmdbApiKey, setTmdbApiKey } from '@/data/kv/settings';
import {
  deduplicateChannels,
  enrichCatalog,
  healthCheckChannels,
  purgeChannels,
} from '@/services';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Screen, TextField } from '@/ui/components';

type Task = 'dedup' | 'health' | 'enrich' | null;

export default function MaintenanceScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const provider = useSessionStore((s) => s.provider);

  const [apiKey, setApiKey] = useState(() => getTmdbApiKey() ?? '');
  const [task, setTask] = useState<Task>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [deadIds, setDeadIds] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const busy = task !== null;

  function saveKey() {
    setTmdbApiKey(apiKey.trim() || null);
    setResult(t('maintenance.saved'));
  }

  async function runDedup() {
    if (!profileId) return;
    setTask('dedup');
    setResult(null);
    try {
      const r = await deduplicateChannels(profileId);
      setResult(t('maintenance.resultDedup', { removed: r.removed, groups: r.groups }));
    } finally {
      setTask(null);
    }
  }

  async function runHealth() {
    if (!profileId || !provider) return;
    setTask('health');
    setResult(null);
    setProgress(0);
    setDeadIds([]);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await healthCheckChannels(profileId, provider, {
        signal: controller.signal,
        onProgress: (d, total) => setProgress(total ? d / total : 0),
      });
      setDeadIds(r.deadIds);
      setResult(t('maintenance.resultHealth', { dead: r.deadIds.length, checked: r.checked }));
    } finally {
      setTask(null);
    }
  }

  async function runPurge() {
    if (!profileId || deadIds.length === 0) return;
    const n = deadIds.length;
    await purgeChannels(profileId, deadIds);
    setDeadIds([]);
    setResult(t('maintenance.resultPurged', { n }));
  }

  async function runEnrich() {
    if (!profileId) return;
    const key = apiKey.trim();
    if (!key) {
      setResult(t('maintenance.needTmdbKey'));
      return;
    }
    setTask('enrich');
    setResult(null);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const r = await enrichCatalog(profileId, key, {
        signal: controller.signal,
        onProgress: (d, total) => setProgress(total ? d / total : 0),
      });
      setResult(t('maintenance.resultEnrich', { enriched: r.enriched, processed: r.processed }));
    } finally {
      setTask(null);
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
            {t('maintenance.title')}
          </AppText>
        </View>
        <AppText variant="caption" muted>
          {t('maintenance.intro')}
        </AppText>

        {busy ? (
          <View
            style={{
              height: 6,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surface,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: '100%',
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        ) : null}

        {result ? (
          <AppText variant="body" color="success">
            {result}
          </AppText>
        ) : null}

        {/* Dedup */}
        <Card>
          <AppText variant="heading">{t('maintenance.dedup')}</AppText>
          <AppText variant="caption" muted>
            {t('maintenance.dedupDesc')}
          </AppText>
          <Button
            title={t('maintenance.run')}
            loading={task === 'dedup'}
            disabled={busy}
            onPress={() => void runDedup()}
          />
        </Card>

        {/* Health check */}
        <Card>
          <AppText variant="heading">{t('maintenance.health')}</AppText>
          <AppText variant="caption" muted>
            {t('maintenance.healthDesc')}
          </AppText>
          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
            <Button
              title={t('maintenance.run')}
              loading={task === 'health'}
              disabled={busy}
              onPress={() => void runHealth()}
            />
            {deadIds.length > 0 ? (
              <Button
                title={t('maintenance.purge')}
                variant="ghost"
                disabled={busy}
                onPress={() => void runPurge()}
              />
            ) : null}
          </View>
        </Card>

        {/* TMDB enrichment */}
        <Card>
          <AppText variant="heading">{t('maintenance.enrich')}</AppText>
          <AppText variant="caption" muted>
            {t('maintenance.enrichDesc')}
          </AppText>
          <TextField
            label={t('maintenance.tmdbKey')}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={t('maintenance.tmdbKeyHint')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
            <Button title={t('maintenance.save')} variant="secondary" onPress={saveKey} />
            <Button
              title={t('maintenance.run')}
              loading={task === 'enrich'}
              disabled={busy}
              onPress={() => void runEnrich()}
            />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
