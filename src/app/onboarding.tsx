import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { setAcceptedDisclaimer, hasAcceptedDisclaimer } from '@/data/kv/settings';
import type { ProviderConfig, ProviderKind } from '@/domain/provider-config';
import { createProvider, ProviderError } from '@/providers';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Chip, Screen, TextField } from '@/ui/components';

export default function Onboarding() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const addProfile = useSessionStore((s) => s.addProfile);

  const [accepted, setAccepted] = useState(hasAcceptedDisclaimer());
  const [kind, setKind] = useState<ProviderKind>('xtream');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildConfig(): ProviderConfig | null {
    if (kind === 'xtream') {
      if (!baseUrl.trim() || !username.trim() || !password.trim()) return null;
      return {
        kind: 'xtream',
        baseUrl: baseUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      };
    }
    if (!playlistUrl.trim()) return null;
    return { kind: 'm3u', playlistUrl: playlistUrl.trim(), epgUrl: epgUrl.trim() || null };
  }

  async function onSubmit() {
    setError(null);
    const config = buildConfig();
    if (!config) {
      setError(t('onboarding.fillRequired'));
      return;
    }
    setBusy(true);
    try {
      // Validate against the provider before persisting anything.
      await createProvider('preview', config).authenticate();
      const profileName = name.trim() || defaultName(config);
      const id = await addProfile(profileName, config);
      router.replace(`/import?profileId=${id}`);
    } catch (e) {
      const pe = ProviderError.from(e);
      setError(
        pe.code === 'auth'
          ? t('onboarding.errorAuth')
          : pe.code === 'network'
            ? t('onboarding.errorNetwork')
            : t('onboarding.errorGeneric'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!accepted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
          <AppText variant="display">{t('disclaimer.title')}</AppText>
          <Card elevated>
            <AppText variant="body" muted style={{ lineHeight: 22 }}>
              {t('disclaimer.body')}
            </AppText>
          </Card>
          <Button
            title={t('disclaimer.accept')}
            fullWidth
            hasTVPreferredFocus
            onPress={() => {
              setAcceptedDisclaimer(true);
              setAccepted(true);
            }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <AppText variant="display">{t('onboarding.addProvider')}</AppText>

        <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
          <Chip
            label={t('onboarding.xtream')}
            selected={kind === 'xtream'}
            onPress={() => setKind('xtream')}
          />
          <Chip
            label={t('onboarding.m3u')}
            selected={kind === 'm3u'}
            onPress={() => setKind('m3u')}
          />
        </View>

        <Card>
          <TextField
            label={t('onboarding.fieldName')}
            value={name}
            onChangeText={setName}
            placeholder={t('onboarding.fieldNamePlaceholder')}
            autoCapitalize="words"
          />
          {kind === 'xtream' ? (
            <>
              <TextField
                label={t('onboarding.fieldServer')}
                value={baseUrl}
                onChangeText={setBaseUrl}
                placeholder="http://host:port"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextField
                label={t('onboarding.fieldUsername')}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextField
                label={t('onboarding.fieldPassword')}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </>
          ) : (
            <>
              <TextField
                label={t('onboarding.fieldPlaylist')}
                value={playlistUrl}
                onChangeText={setPlaylistUrl}
                placeholder="http://host/playlist.m3u"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextField
                label={t('onboarding.fieldEpg')}
                value={epgUrl}
                onChangeText={setEpgUrl}
                placeholder="http://host/xmltv.php (optionnel)"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </>
          )}
        </Card>

        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : null}

        <Button
          title={t('onboarding.connect')}
          fullWidth
          loading={busy}
          onPress={onSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

function defaultName(config: ProviderConfig): string {
  if (config.kind === 'xtream') {
    try {
      return new URL(config.baseUrl).hostname;
    } catch {
      return 'Xtream';
    }
  }
  return 'M3U';
}
