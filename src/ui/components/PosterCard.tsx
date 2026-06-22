import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface PosterCardProps {
  title: string;
  posterUrl?: string | null;
  subtitle?: string | null;
  width: number;
  onPress?: () => void;
  /** Overlay node pinned top-right (e.g. a favorite button). */
  topRight?: ReactNode;
  /** Resume progress 0..1, drawn as a bar along the bottom of the poster. */
  progress?: number;
  /** Render the title over a scrim inside the poster instead of below it. */
  overlayTitle?: boolean;
  /** Poster aspect ratio (height = width * ratio). Default 1.5 (2:3). */
  ratio?: number;
}

/** A soft bottom-up scrim that keeps overlaid text legible on any poster. */
function Scrim() {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' }} />
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.42)' }} />
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)' }} />
    </View>
  );
}

/** Focusable poster tile for VOD / series grids. */
export function PosterCard({
  title,
  posterUrl,
  subtitle,
  width,
  onPress,
  topRight,
  progress,
  overlayTitle,
  ratio = 1.5,
}: PosterCardProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors, radius, space, focus } = theme;

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width,
        transform: [{ scale: focused ? focus.scale : 1 }],
      }}>
      <View
        style={[
          {
            width,
            height: width * ratio,
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: focused ? focus.ringWidth : 1,
            borderColor: focused ? focus.ringColor : colors.border,
          },
          // Resting depth so posters feel like physical cards.
          focused ? theme.shadow.focus : theme.shadow.card,
        ]}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: space.sm,
            }}>
            <AppText variant="caption" muted center numberOfLines={3}>
              {title}
            </AppText>
          </View>
        )}

        {overlayTitle ? <Scrim /> : null}

        {topRight ? (
          <View style={{ position: 'absolute', top: space.sm, right: space.sm }}>
            {topRight}
          </View>
        ) : null}

        {overlayTitle ? (
          <View
            style={{
              position: 'absolute',
              left: space.sm,
              right: space.sm,
              bottom: progress != null && progress > 0 ? space.sm + 4 : space.sm,
            }}>
            <AppText variant="heading" numberOfLines={2} style={{ fontSize: 15 }}>
              {title}
            </AppText>
            {subtitle ? (
              <AppText variant="caption" muted numberOfLines={1}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {progress != null && progress > 0 ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}>
            <View
              style={{
                width: `${Math.min(100, Math.round(progress * 100))}%`,
                height: '100%',
                backgroundColor: colors.accent,
              }}
            />
          </View>
        ) : null}
      </View>

      {!overlayTitle ? (
        <>
          <AppText
            variant="caption"
            numberOfLines={1}
            style={{ marginTop: space.sm, color: colors.text }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" muted numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </>
      ) : null}
    </Pressable>
  );
}
