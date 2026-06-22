import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface ListRowProps {
  title: string;
  subtitle?: string | null;
  /** Leading logo/poster URL. */
  imageUrl?: string | null;
  /** Leading badge text (e.g. channel number) when there's no image. */
  leadingBadge?: string | null;
  /** Trailing pill text (e.g. a quality tag like "1080p"). */
  badge?: string | null;
  /** Colored dot before the subtitle (e.g. a "live now" marker). */
  dotColor?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}

/** Generic focusable list row for channels / catalog items. */
export function ListRow({
  title,
  subtitle,
  imageUrl,
  leadingBadge,
  badge,
  dotColor,
  trailing,
  onPress,
  onLongPress,
}: ListRowProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors, radius, space, focus } = theme;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm + 2,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        borderWidth: focused ? focus.ringWidth : 0,
        borderColor: focus.ringColor,
        // Idle rows get a hairline divider; focused/pressed rows lift instead.
        borderBottomWidth: focused ? focus.ringWidth : StyleSheet.hairlineWidth,
        borderBottomColor: focused ? focus.ringColor : colors.border,
        backgroundColor: focused
          ? colors.surfaceElevated
          : pressed
            ? colors.surface
            : 'transparent',
      })}>
      {/* Logo sits in a rounded tile so transparent/varied logos read cleanly. */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: '78%', height: '78%' }}
            contentFit="contain"
            transition={120}
          />
        ) : (
          <AppText variant="mono" muted>
            {leadingBadge ?? '—'}
          </AppText>
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 }}>
            {dotColor ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: dotColor,
                }}
              />
            ) : null}
            <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
              {subtitle}
            </AppText>
          </View>
        ) : null}
      </View>

      {badge ? (
        <View
          style={{
            paddingHorizontal: space.sm,
            paddingVertical: 2,
            borderRadius: radius.sm,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <AppText variant="caption" muted style={{ fontSize: 10, letterSpacing: 0.4 }}>
            {badge}
          </AppText>
        </View>
      ) : null}

      {trailing}
    </Pressable>
  );
}
