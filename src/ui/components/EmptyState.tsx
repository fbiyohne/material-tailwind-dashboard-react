import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ComponentProps<typeof Feather>['name'];
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Centered empty/zero state — an invitation to act, not just a dead end. */
export function EmptyState({
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: theme.space.xxl,
        paddingHorizontal: theme.space.lg,
        gap: theme.space.sm,
      }}>
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          marginBottom: theme.space.xs,
        }}>
        <Feather name={icon} size={26} color={theme.colors.textMuted} />
      </View>
      <AppText variant="heading" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" muted center style={{ maxWidth: 320, lineHeight: 21 }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: theme.space.sm }}>
          <Button title={actionLabel} variant="secondary" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
