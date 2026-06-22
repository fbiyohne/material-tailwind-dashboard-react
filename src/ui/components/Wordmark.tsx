import { Text, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { fonts } from '@/ui/tokens/fonts';

interface WordmarkProps {
  /** Cap height of the "Creatic" word, in px. Default 30. */
  size?: number;
  /** Stack "IPTV" under "Creatic" instead of inline. */
  stacked?: boolean;
}

/**
 * Brand lockup — "Creatic" in the Fraunces serif (the editorial voice) paired
 * with a tracked "IPTV" in gold (the single accent, per the design DNA).
 */
export function Wordmark({ size = 30, stacked = false }: WordmarkProps) {
  const theme = useTheme();
  const tag = (
    <Text
      style={{
        fontFamily: fonts.interSemiBold,
        fontSize: Math.round(size * 0.42),
        color: theme.colors.accent,
        letterSpacing: Math.max(2, size * 0.12),
        marginBottom: stacked ? 0 : Math.round(size * 0.12),
      }}>
      IPTV
    </Text>
  );

  return (
    <View
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'flex-end',
        gap: stacked ? 2 : Math.round(size * 0.28),
      }}>
      <Text
        style={{
          fontFamily: fonts.frauncesBold,
          fontSize: size,
          lineHeight: Math.round(size * 1.05),
          color: theme.colors.text,
          letterSpacing: -0.5,
        }}>
        Creatic
      </Text>
      {tag}
    </View>
  );
}
