import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { tvFocusProps } from '@/lib/tv';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  /** Request initial D-pad focus on TV. */
  hasTVPreferredFocus?: boolean;
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
  hasTVPreferredFocus,
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
      {...tvFocusProps(hasTVPreferredFocus)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: space.md,
          paddingHorizontal: space.lg,
          borderWidth: focused ? focus.ringWidth : variant === 'ghost' ? 1 : 0,
          borderColor: focused ? focus.ringColor : colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
          transform: [{ scale: focused ? focus.scale : pressed ? 0.97 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        // Resting depth on the solid primary button (premium lift).
        variant === 'primary' && !focused && styles.primaryShadow,
        focused && theme.shadow.focus,
      ]}
      {...rest}>
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <AppText variant="heading" style={{ color: fg, fontSize: 15 }}>
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
  primaryShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
