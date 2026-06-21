import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useParentalStore } from '@/state/parentalStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, Button, Card, Screen, TextField } from '@/ui/components';

/** Modal PIN prompt. On success the session is unlocked and we pop back. */
export default function UnlockScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const verify = useParentalStore((s) => s.verify);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (await verify(pin)) {
      router.back();
    } else {
      setError(t('parental.wrongPin'));
      setPin('');
    }
  }

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.space.lg }}>
        <AppText variant="display">{t('parental.locked')}</AppText>
        <Card elevated>
          <TextField
            label={t('parental.enterPin')}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            autoFocus
            error={error}
            onSubmitEditing={submit}
          />
        </Card>
        <Button title={t('parental.unlock')} fullWidth onPress={submit} />
        <Button title={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
