import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from '@/ui/components';

/**
 * Full-screen player. Wraps react-native-video (Media3/ExoPlayer on Android,
 * AVPlayer on iOS) — we habille the engine, we don't reimplement it. Built-in
 * native controls expose subtitles / audio tracks; richer controls come later.
 */
export default function PlayerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}>
      {url ? (
        <Video
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          controls
          resizeMode="contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setErrored(true);
          }}
        />
      ) : null}

      {loading && !errored ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator color={theme.colors.accent} />
          <AppText variant="caption" style={{ color: '#fff', marginTop: 8 }}>
            {t('player.loading')}
          </AppText>
        </View>
      ) : null}

      {errored ? (
        <View style={styles.center}>
          <AppText variant="body" style={{ color: '#fff' }}>
            {t('player.error')}
          </AppText>
        </View>
      ) : null}

      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <AppText variant="body" style={{ color: '#fff' }}>
            ‹ {title ?? t('common.back')}
          </AppText>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, padding: 12 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
});
