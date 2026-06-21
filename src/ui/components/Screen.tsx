import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/ui/ThemeProvider';

interface ScreenProps {
  children: ReactNode;
  /** Add default horizontal/vertical padding. Default true. */
  padded?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

/** Theme-aware screen container with safe-area handling. */
export function Screen({ children, padded = true, edges, style }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <View
        style={[
          styles.inner,
          padded && { paddingHorizontal: theme.space.xl, paddingVertical: theme.space.lg },
          style,
        ]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1 },
});
