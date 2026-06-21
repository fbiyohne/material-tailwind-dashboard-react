import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initI18n } from '@/i18n';
import { useSessionStore } from '@/state/sessionStore';
import { colors } from '@/ui/tokens';

export default function RootLayout() {
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const ready = useSessionStore((s) => s.ready);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap(); // encrypted stores + DB migrations + restore profile
      initI18n(); // safe to read settings now
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  if (!ready || !booted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
