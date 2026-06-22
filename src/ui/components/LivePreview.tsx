import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import type { Channel } from '@/domain/models';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface LivePreviewProps {
  channel: Channel | null;
  streamUrl: string | null;
  onFullscreen: () => void;
  /** Pause playback (e.g. when the Live tab is not focused). */
  paused?: boolean;
}

/** Inline 16:9 channel preview. Tap to go full-screen. */
export function LivePreview({ channel, streamUrl, onFullscreen, paused }: LivePreviewProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: theme.radius.md,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      {streamUrl ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onFullscreen}>
          <Video
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            paused={paused}
            resizeMode="contain"
            onLoadStart={() => {
              setLoading(true);
              setErrored(false);
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setErrored(true);
            }}
          />
          {loading && !errored ? (
            <View style={styles.center} pointerEvents="none">
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : null}
          {errored ? (
            <View style={styles.center} pointerEvents="none">
              <AppText variant="caption" style={{ color: '#fff' }}>
                Flux indisponible
              </AppText>
            </View>
          ) : null}
          {/* Bottom scrim: channel name + fullscreen affordance. */}
          <View style={styles.bottomBar} pointerEvents="none">
            <AppText variant="caption" numberOfLines={1} style={styles.barText}>
              {channel?.name ?? ''}
            </AppText>
            <Feather name="maximize" size={16} color="#fff" />
          </View>
        </Pressable>
      ) : (
        <View style={[styles.center, { padding: theme.space.lg }]} pointerEvents="none">
          <Feather name="play-circle" size={30} color={theme.colors.textMuted} />
          <AppText variant="caption" muted center style={{ marginTop: theme.space.sm }}>
            Touchez une chaîne pour la prévisualiser.
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  barText: { flex: 1, color: '#fff' },
});
