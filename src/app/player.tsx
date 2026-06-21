import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Video, { type VideoRef } from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import { progressRepo } from '@/data';
import type { StreamKind } from '@/domain/models';
import { useSessionStore } from '@/state/sessionStore';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText, FavoriteButton } from '@/ui/components';

const SAVE_INTERVAL = 5; // seconds between progress writes

/**
 * Full-screen player. Wraps react-native-video; adds resume (seek to last
 * position) and progress recording (continue-watching + recents) on top.
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
  const tracked = !!itemId && !!kind;
  const resumable = tracked && kind !== 'live';

  const videoRef = useRef<VideoRef>(null);
  const positionRef = useRef(0);
  const durationRef = useRef<number | null>(null);
  const lastSavedRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [startPos, setStartPos] = useState(0);

  // Resolve resume point (and record a recent for live channels).
  useEffect(() => {
    if (!profileId || !itemId || !kind) return;
    if (kind === 'live') {
      void progressRepo.saveProgress({ profileId, itemId, kind, positionSecs: 0 });
      return;
    }
    void progressRepo.getProgress(profileId, itemId).then((p) => {
      if (p && p.positionSecs > 5) setStartPos(p.positionSecs);
    });
  }, [profileId, itemId, kind]);

  // Persist final position when leaving.
  useEffect(() => {
    return () => {
      if (profileId && itemId && kind && kind !== 'live' && positionRef.current > 0) {
        void progressRepo.saveProgress({
          profileId,
          itemId,
          kind,
          positionSecs: positionRef.current,
          durationSecs: durationRef.current,
        });
      }
    };
  }, [profileId, itemId, kind]);

  return (
    <View style={styles.root}>
      {url ? (
        <Video
          ref={videoRef}
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          controls
          resizeMode="contain"
          onLoad={(data: { duration: number }) => {
            durationRef.current = data.duration;
            setLoading(false);
            if (startPos > 0) videoRef.current?.seek(startPos);
          }}
          onProgress={(data: { currentTime: number }) => {
            positionRef.current = data.currentTime;
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
          style={[styles.pill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <AppText variant="body" style={{ color: '#fff' }}>
            ‹ {title ?? t('common.back')}
          </AppText>
        </Pressable>
        {tracked && itemId && kind ? (
          <FavoriteButton profileId={profileId} itemId={itemId} kind={kind} overlay size={20} />
        ) : null}
      </SafeAreaView>
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
});
