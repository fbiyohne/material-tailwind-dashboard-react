import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional accent / selected color (e.g. per-kind hue). */
  accent?: string;
}

/** Selectable, focusable pill — used for category filters. */
export function Chip({ label, selected, onPress, accent }: ChipProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors, radius, space, focus } = theme;
  const activeColor = accent ?? colors.accent;

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs + 2,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: focused ? focus.ringWidth : 1,
        borderColor: selected
          ? activeColor
          : focused
            ? focus.ringColor
            : colors.border,
        // Selected reads as a solid, confident pill; idle stays quiet.
        backgroundColor: selected ? activeColor : colors.surface,
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: focused ? focus.scale : pressed ? 0.97 : 1 }],
      })}>
      {/* Tiny dot on idle chips that carry a kind-hue, for a touch of identity. */}
      {!selected && accent ? (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: accent,
          }}
        />
      ) : null}
      <AppText
        variant="caption"
        style={{ color: selected ? colors.bg : colors.textMuted }}>
        {label}
      </AppText>
    </Pressable>
  );
}
