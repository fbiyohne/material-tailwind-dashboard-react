import { useState } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Optional accent dot / selected color (e.g. per-kind hue). */
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
      style={{
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: focused ? focus.ringWidth : 1,
        borderColor: selected ? activeColor : focused ? focus.ringColor : colors.border,
        backgroundColor: selected ? colors.surfaceElevated : colors.surface,
        transform: [{ scale: focused ? focus.scale : 1 }],
      }}>
      <AppText variant="caption" style={{ color: selected ? colors.text : colors.textMuted }}>
        {label}
      </AppText>
    </Pressable>
  );
}
