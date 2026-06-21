import { Image } from 'expo-image';
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
}

/** Focusable poster tile for VOD / series grids. */
export function PosterCard({ title, posterUrl, subtitle, width, onPress }: PosterCardProps) {
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
            height: width * 1.5,
            borderRadius: radius.md,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: focused ? focus.ringWidth : 1,
            borderColor: focused ? focus.ringColor : colors.border,
          },
          focused && theme.shadow.focus,
        ]}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.sm }}>
            <AppText variant="caption" muted center numberOfLines={3}>
              {title}
            </AppText>
          </View>
        )}
      </View>
      <AppText variant="caption" numberOfLines={1} style={{ marginTop: space.xs }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" muted numberOfLines={1}>
          {subtitle}
        </AppText>
      ) : null}
    </Pressable>
  );
}
