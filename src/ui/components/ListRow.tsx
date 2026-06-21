import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface ListRowProps {
  title: string;
  subtitle?: string | null;
  /** Leading logo/poster URL. */
  imageUrl?: string | null;
  /** Leading badge text (e.g. channel number) when there's no image. */
  leadingBadge?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
}

/** Generic focusable list row for channels / catalog items. */
export function ListRow({
  title,
  subtitle,
  imageUrl,
  leadingBadge,
  trailing,
  onPress,
}: ListRowProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors, radius, space, focus } = theme;

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.md,
        borderWidth: focused ? focus.ringWidth : 0,
        borderColor: focus.ringColor,
        backgroundColor: focused ? colors.surfaceElevated : 'transparent',
      }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 44, height: 44, borderRadius: radius.sm }}
          contentFit="contain"
          transition={120}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <AppText variant="mono" muted>
            {leadingBadge ?? '—'}
          </AppText>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <AppText variant="body" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
