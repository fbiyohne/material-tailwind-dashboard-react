import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type VideoRef } from 'react-native-video';
import { progressRepo } from '@/data';
import type { StreamKind } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, FavoriteButton } from '@/ui/components';

const SAVE_INTERVAL = 5; // seconds between progress writes
const AUTO_HIDE_MS = 3500;

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Play / pause glyphs drawn with views, so no icon font is required. */
function PlayPauseGlyph({ paused }: { paused: boolean }) {
  if (paused) {
    return (
      <View
        style={{
          width: 0,
          height: 0,
          marginLeft: 6,
          borderTopWidth: 15,
          borderBottomWidth: 15,
          borderLeftWidth: 24,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#fff',
        }}
      />
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

/**
 * Full-screen player. Wraps react-native-video with a custom, themed control
 * overlay (auto-hiding), resume (seek to last position) and progress recording.
 */
export default function PlayerScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const profileId = useSessionStore((s) => s.activeProfileId);
  const params = useLocalSearchParams<{
    url: string;
    title?: string;
    itemId?: string;
    kind?: string;
  }>();
  const { url, title, itemId } = params;
  const kind = (params.kind as StreamKind | undefined) ?? undefined;
  const isLive = kind === 'live';
  const tracked = !!itemId && !!kind;
  const resumable = tracked && !isLive;

  const videoRef = useRef<VideoRef>(null);
  const positionRef = useRef(0);
  const durationRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);
  const trackWidth = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fade] = useState(() => new Animated.Value(1));

  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [errored, setErrored] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startPos, setStartPos] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsShown, setControlsShown] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  // Resolve resume point (and record a recent for live channels).
  useEffect(() => {
    if (!profileId || !itemId || !kind) return;
    if (isLive) {
      void progressRepo.saveProgress({ profileId, itemId, kind, positionSecs: 0 });
      return;
    }
    void progressRepo.getProgress(profileId, itemId).then((p) => {
      if (p && p.positionSecs > 5) setStartPos(p.positionSecs);
    });
  }, [profileId, itemId, kind, isLive]);

  // Persist final position when leaving.
  useEffect(() => {
    return () => {
      if (profileId && itemId && kind && !isLive && positionRef.current > 0) {
        void progressRepo.saveProgress({
          profileId,
          itemId,
          kind,
          positionSecs: positionRef.current,
          durationSecs: durationRef.current,
        });
      }
    };
  }, [profileId, itemId, kind, isLive]);

  // Fade the overlay in/out.
  useEffect(() => {
    Animated.timing(fade, {
      toValue: controlsShown ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [controlsShown, fade]);

  // Auto-hide while actively playing.
  useEffect(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (controlsShown && !paused && !errored && !loading) {
      hideTimer.current = setTimeout(() => setControlsShown(false), AUTO_HIDE_MS);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [controlsShown, paused, errored, loading]);

  // Give up on a stream that never loads (dead URL / unsupported codec) so the
  // user gets an actionable error instead of an endless spinner.
  useEffect(() => {
    if (!loading || errored) return;
    const id = setTimeout(() => setErrored(true), 20000);
    return () => clearTimeout(id);
  }, [loading, errored, retryKey]);

  const retry = useCallback(() => {
    setErrored(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  const bumpControls = useCallback(() => setControlsShown(true), []);
  const toggleControls = useCallback(() => setControlsShown((v) => !v), []);

  const seekTo = useCallback((secs: number) => {
    const clamped = Math.max(0, secs);
    videoRef.current?.seek(clamped);
    positionRef.current = clamped;
    setCurrent(clamped);
  }, []);

  const onTrackPress = useCallback(
    (e: { nativeEvent: { locationX: number } }) => {
      if (!duration || !trackWidth.current) return;
      const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth.current));
      seekTo(ratio * duration);
      bumpControls();
    },
    [duration, seekTo, bumpControls],
  );

  const ratio = duration > 0 ? Math.min(1, current / duration) : 0;
  const accent = theme.colors.accent;

  return (
    <View style={styles.root}>
      {url ? (
        <Video
          key={retryKey}
          ref={videoRef}
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          paused={paused}
          resizeMode="contain"
          onLoad={(data: { duration: number }) => {
            durationRef.current = data.duration;
            setDuration(data.duration);
            setLoading(false);
            if (startPos > 0) videoRef.current?.seek(startPos);
          }}
          onBuffer={(e: { isBuffering: boolean }) => setBuffering(e.isBuffering)}
          onProgress={(data: { currentTime: number }) => {
            positionRef.current = data.currentTime;
            setCurrent(data.currentTime);
            if (
              resumable &&
              profileId &&
              itemId &&
              kind &&
              data.currentTime - lastSavedRef.current >= SAVE_INTERVAL
            ) {
              lastSavedRef.current = data.currentTime;
              void progressRepo.saveProgress({
                profileId,
                itemId,
                kind,
                positionSecs: data.currentTime,
                durationSecs: durationRef.current,
              });
            }
          }}
          onError={() => {
            setLoading(false);
            setErrored(true);
          }}
        />
      ) : null}

      {/* Tap anywhere to toggle the controls. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls} />

      {/* Buffering / initial loading spinner. */}
      {(loading || buffering) && !errored ? (
        <View style={styles.center} pointerEvents="none">
          <ActivityIndicator size="large" color={accent} />
          {loading ? (
            <AppText variant="caption" style={styles.dimText}>
              {t('player.loading')}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Error state (interactive — offers a retry). */}
      {errored ? (
        <View style={styles.center}>
          <View style={styles.errorBadge}>
            <AppText variant="heading" style={{ color: '#fff', fontSize: 16 }}>
              {t('player.error')}
            </AppText>
            <Pressable onPress={retry} hitSlop={8} style={styles.retryBtn}>
              <AppText variant="caption" style={{ color: '#fff', letterSpacing: 0.5 }}>
                {t('common.retry')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Control overlay. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        pointerEvents={controlsShown ? 'box-none' : 'none'}>
        {/* Top scrim + title row. */}
        <View style={styles.topScrim} pointerEvents="box-none">
          <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={styles.backPill}>
              <AppText variant="heading" style={{ color: '#fff', fontSize: 15 }}>
                ‹{'  '}
                {title ?? t('common.back')}
              </AppText>
            </Pressable>
            {tracked && itemId && kind ? (
              <FavoriteButton
                profileId={profileId}
                itemId={itemId}
                kind={kind}
                overlay
                size={20}
              />
            ) : null}
          </SafeAreaView>
        </View>

        {/* Center transport. */}
        {!errored ? (
          <View style={styles.center} pointerEvents="box-none">
            <View style={styles.transport} pointerEvents="box-none">
              {!isLive ? (
                <Pressable
                  onPress={() => {
                    seekTo(Math.max(0, current - 10));
                  }}
                  hitSlop={10}
                  style={styles.skipBtn}>
                  <AppText style={styles.skipText}>↺ 10</AppText>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  setPaused((p) => !p);
                  bumpControls();
                }}
                hitSlop={12}
                style={styles.playBtn}>
                <PlayPauseGlyph paused={paused} />
              </Pressable>

              {!isLive ? (
                <Pressable
                  onPress={() => {
                    seekTo(current + 10);
                  }}
                  hitSlop={10}
                  style={styles.skipBtn}>
                  <AppText style={styles.skipText}>10 ↻</AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Bottom scrim + timeline / live badge. */}
        <View style={styles.bottomScrim} pointerEvents="box-none">
          <SafeAreaView edges={['bottom']} pointerEvents="box-none">
            {isLive ? (
              <View style={styles.liveRow}>
                <View style={[styles.liveDot, { backgroundColor: theme.colors.danger }]} />
                <AppText
                  variant="caption"
                  style={{ color: '#fff', letterSpacing: 1.5, fontSize: 12 }}>
                  LIVE
                </AppText>
              </View>
            ) : (
              <View style={styles.timeline}>
                <AppText variant="mono" style={styles.timeText}>
                  {fmt(current)}
                </AppText>
                <Pressable
                  style={styles.trackHit}
                  onPress={onTrackPress}
                  onLayout={(e: LayoutChangeEvent) => {
                    trackWidth.current = e.nativeEvent.layout.width;
                  }}>
                  <View style={styles.track}>
                    <View
                      style={[styles.trackFill, { width: `${ratio * 100}%`, backgroundColor: accent }]}
                    />
                    <View
                      style={[
                        styles.thumb,
                        { left: `${ratio * 100}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                </Pressable>
                <AppText variant="mono" style={styles.timeText}>
                  {fmt(duration)}
                </AppText>
              </View>
            )}
          </SafeAreaView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimText: { color: 'rgba(255,255,255,0.85)', marginTop: 10 },
  errorBadge: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 36,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  backPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  playBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18,18,20,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pauseBar: { width: 8, height: 28, borderRadius: 2, backgroundColor: '#fff' },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  skipText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 40,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  timeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, minWidth: 44, textAlign: 'center' },
  trackHit: { flex: 1, paddingVertical: 10, justifyContent: 'center' },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
  },
  trackFill: { height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
});
