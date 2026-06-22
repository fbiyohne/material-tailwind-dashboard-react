import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface HeaderBarProps {
  title: string;
  subtitle?: string | null;
  /** Defaults to router.back(). */
  onBack?: () => void;
  /** Trailing actions (icons/buttons) pinned right. */
  right?: ReactNode;
  /** Title size. Default 'title' (serif on Éditorial). */
  variant?: 'title' | 'heading' | 'display';
}

/** Shared screen header: back affordance + title + optional trailing actions. */
export function HeaderBar({
  title,
  subtitle,
  onBack,
  right,
  variant = 'title',
}: HeaderBarProps) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.sm,
        paddingVertical: theme.space.sm,
      }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        style={{ padding: 4, marginLeft: -4 }}>
        <Feather name="chevron-left" size={26} color={theme.colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <AppText variant={variant} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}
