import { useFonts } from 'expo-font';
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
  // Direct .ttf requires (only the weights we use) — avoids each package's
  // index.js, which pulls in every weight and can break if one file is absent.
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
    Inter_500Medium: require('@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
    Fraunces_600SemiBold: require('@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf'),
    Fraunces_700Bold: require('@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf'),
    SpaceGrotesk_500Medium: require('@expo-google-fonts/space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf'),
    SpaceGrotesk_700Bold: require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'),
    JetBrainsMono_500Medium: require('@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'),
    JetBrainsMono_600SemiBold: require('@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf'),
    Nunito_500Medium: require('@expo-google-fonts/nunito/500Medium/Nunito_500Medium.ttf'),
    Nunito_700Bold: require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf'),
  });

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

  if (!ready || !booted || !fontsLoaded) {
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
