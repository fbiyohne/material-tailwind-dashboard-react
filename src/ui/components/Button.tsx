import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
}

/**
 * Themed, focusable button. Focus state (ring + scale) is driven by the theme so
 * the same component reads correctly on touch (mobile) and from a distance (TV).
 */
export function Button({
  title,
  variant = 'primary',
  loading,
  fullWidth,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { colors, radius, space, focus } = theme;

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.surfaceElevated
        : 'transparent';
  const fg = variant === 'primary' ? colors.bg : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderWidth: focused ? focus.ringWidth : variant === 'ghost' ? 1 : 0,
          borderColor: focused ? focus.ringColor : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: focused ? focus.scale : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        focused && theme.shadow.focus,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <AppText variant="body" style={{ color: fg, fontWeight: '600' }}>
            {title}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
