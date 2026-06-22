import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { setAcceptedDisclaimer, hasAcceptedDisclaimer } from '@/data/kv/settings';
import type { ProviderConfig, ProviderKind } from '@/domain/provider-config';
import { createProvider, ProviderError } from '@/providers';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Screen, TextField } from '@/ui/components';

const PROVIDER_KINDS = ['xtream', 'm3u'] as const;

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
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.xl }}>
          <View style={{ alignItems: 'center', gap: theme.space.md }}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={{ width: 80, height: 80, borderRadius: 22 }}
              contentFit="cover"
            />
            <AppText variant="display" center style={{ letterSpacing: -0.5 }}>
              CreaticTV
            </AppText>
          </View>

          <Card elevated style={{ gap: theme.space.md }}>
            <AppText variant="heading">{t('disclaimer.title')}</AppText>
            <AppText variant="body" muted style={{ lineHeight: 23 }}>
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
        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={{ width: 56, height: 56, borderRadius: 16 }}
            contentFit="cover"
          />
          <AppText variant="display" center>
            {t('onboarding.addProvider')}
          </AppText>
        </View>

        {/* Segmented source selector. */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.pill,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 4,
          }}>
          {PROVIDER_KINDS.map((k) => {
            const active = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={{
                  flex: 1,
                  paddingVertical: theme.space.sm + 2,
                  borderRadius: theme.radius.pill,
                  alignItems: 'center',
                  backgroundColor: active ? theme.colors.accent : 'transparent',
                }}>
                <AppText
                  variant="caption"
                  style={{ color: active ? theme.colors.bg : theme.colors.textMuted }}>
                  {t(k === 'xtream' ? 'onboarding.xtream' : 'onboarding.m3u')}
                </AppText>
              </Pressable>
            );
          })}
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
