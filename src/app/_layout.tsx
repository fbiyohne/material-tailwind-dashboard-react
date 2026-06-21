import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initI18n } from '@/i18n';
import { useParentalStore } from '@/state/parentalStore';
import { useSessionStore } from '@/state/sessionStore';
import { useThemeStore } from '@/state/themeStore';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';
import { defaultTheme } from '@/ui/themes';

function ThemedStack() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const ready = useSessionStore((s) => s.ready);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateParental = useParentalStore((s) => s.hydrate);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap(); // encrypted stores + DB migrations + restore profile
      initI18n(); // safe to read settings now
      hydrateTheme(); // restore the saved theme preference
      hydrateParental(); // know whether a PIN is configured
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, hydrateTheme, hydrateParental]);

  if (!ready || !booted) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: defaultTheme.colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={defaultTheme.colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
