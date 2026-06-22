import { View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface ProgressBarProps {
  /** 0..1 */
  progress: number;
  label?: string | null;
  showPercent?: boolean;
  error?: boolean;
}

/** Themed determinate progress bar with an optional label/percent row. */
export function ProgressBar({ progress, label, showPercent, error }: ProgressBarProps) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const fill = error ? theme.colors.danger : theme.colors.accent;
  return (
    <View style={{ gap: theme.space.xs + 2 }}>
      {label || showPercent ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
          {label ? (
            <AppText variant="caption" muted>
              {label}
            </AppText>
          ) : (
            <View />
          )}
          {showPercent ? (
            <AppText variant="mono" color={error ? 'danger' : 'textMuted'}>
              {pct}%
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          height: 8,
          borderRadius: theme.radius.pill,
          backgroundColor: theme.colors.surfaceElevated,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: theme.radius.pill,
            backgroundColor: fill,
          }}
        />
      </View>
    </View>
  );
}
