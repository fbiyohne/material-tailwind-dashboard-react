import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import type { ThemeColors } from '@/ui/tokens/contract';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'mono';

interface AppTextProps extends TextProps {
  variant?: Variant;
  /** Theme color key; defaults to primary text. */
  color?: keyof ThemeColors;
  muted?: boolean;
  center?: boolean;
}

/** Themed Text. All typography flows from the active theme's type scale. */
export function AppText({
  variant = 'body',
  color,
  muted,
  center,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const token = theme.typography[variant];
  const resolved: TextStyle = {
    fontFamily: token.fontFamily,
    fontSize: token.fontSize,
    fontWeight: token.fontWeight,
    letterSpacing: token.letterSpacing,
    color: color
      ? theme.colors[color]
      : muted
        ? theme.colors.textMuted
        : theme.colors.text,
    textAlign: center ? 'center' : undefined,
  };
  return <Text style={[resolved, style]} {...rest} />;
}
