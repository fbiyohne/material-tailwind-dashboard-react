import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';

interface CardProps {
  children: ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
}

/** Themed surface card. */
export function Card({ children, elevated, style }: CardProps) {
  const theme = useTheme();
  const { colors, radius, space, shadow } = theme;
  return (
    <View
      style={[
        {
          backgroundColor: elevated ? colors.surfaceElevated : colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: space.lg,
          gap: space.sm,
        },
        elevated && shadow.card,
        style,
      ]}>
      {children}
    </View>
  );
}
