import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { setLocale } from '@/data/kv/settings';
import i18n from '@/i18n';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useThemeStore } from '@/state/themeStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Chip, Screen, TextField } from '@/ui/components';
import { themes } from '@/ui/themes';
import type { ThemeName } from '@/ui/tokens/contract';

const THEME_OPTIONS: readonly ThemeName[] = ['editorial', 'controlRoom', 'softDepth'];
const LANGS = ['fr', 'en'] as const;

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  const themeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);

  const profiles = useSessionStore((s) => s.profiles);
  const activeProfileId = useSessionStore((s) => s.activeProfileId);
  const switchProfile = useSessionStore((s) => s.switchProfile);
  const removeProfile = useSessionStore((s) => s.removeProfile);

  const hasPin = useParentalStore((s) => s.hasPin);
  const unlocked = useParentalStore((s) => s.unlocked);
  const setPin = useParentalStore((s) => s.setPin);
  const removePin = useParentalStore((s) => s.removePin);
  const lock = useParentalStore((s) => s.lock);
  const [pinInput, setPinInput] = useState('');

  function changeLang(lng: string) {
    setLocale(lng);
    void i18n.changeLanguage(lng);
  }

  async function savePin() {
    if (pinInput.trim().length < 4) return;
    await setPin(pinInput.trim());
    setPinInput('');
  }

  async function onRemove(id: string) {
    await removeProfile(id);
    if (useSessionStore.getState().profiles.length === 0) {
      router.replace('/onboarding');
    }
  }

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.xl }}>
        <AppText variant="display">{t('settings.title')}</AppText>

        {/* Appearance */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('settings.appearance')}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
            {THEME_OPTIONS.map((name) => (
              <Chip
                key={name}
                label={themes[name].label}
                selected={name === themeName}
                accent={themes[name].colors.accent}
                onPress={() => setTheme(name)}
              />
            ))}
          </View>
        </View>

        {/* Language */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('settings.language')}</AppText>
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            {LANGS.map((lng) => (
              <Chip
                key={lng}
                label={lng.toUpperCase()}
                selected={i18n.language === lng}
                onPress={() => changeLang(lng)}
              />
            ))}
          </View>
        </View>

        {/* Providers */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('settings.profiles')}</AppText>
          {profiles.map((p) => {
            const active = p.id === activeProfileId;
            return (
              <Card key={p.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="body">{p.name}</AppText>
                    <AppText variant="caption" muted>
                      {p.kind.toUpperCase()}
                      {active ? ` · ${t('settings.active')}` : ''}
                    </AppText>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
                  {active ? (
                    <Button
                      title={t('settings.refresh')}
                      variant="secondary"
                      onPress={() => router.push('/import')}
                    />
                  ) : (
                    <Button
                      title={t('settings.switchTo')}
                      variant="secondary"
                      onPress={() => void switchProfile(p.id)}
                    />
                  )}
                  <Button
                    title={t('settings.remove')}
                    variant="ghost"
                    onPress={() => void onRemove(p.id)}
                  />
                </View>
              </Card>
            );
          })}
          <Button
            title={t('settings.addProvider')}
            onPress={() => router.push('/onboarding')}
          />
        </View>

        {/* Category curation */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('categories.title')}</AppText>
          <Button
            title={t('categories.manage')}
            variant="secondary"
            onPress={() => router.push('/categories')}
          />
        </View>

        {/* Parental control */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('parental.title')}</AppText>
          <Card>
            <TextField
              label={hasPin ? t('parental.changePin') : t('parental.setPin')}
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="••••"
            />
            <View style={{ flexDirection: 'row', gap: theme.space.sm, flexWrap: 'wrap' }}>
              <Button title={t('parental.save')} onPress={() => void savePin()} />
              {hasPin ? (
                <Button
                  title={t('parental.removePin')}
                  variant="ghost"
                  onPress={removePin}
                />
              ) : null}
              {hasPin && unlocked ? (
                <Button title={t('parental.lockNow')} variant="ghost" onPress={lock} />
              ) : null}
            </View>
          </Card>
        </View>

        {/* About */}
        <View style={{ gap: theme.space.sm }}>
          <AppText variant="heading">{t('settings.about')}</AppText>
          <AppText variant="caption" muted>
            {t('settings.disclaimer')}
          </AppText>
        </View>
      </ScrollView>
    </Screen>
  );
}
