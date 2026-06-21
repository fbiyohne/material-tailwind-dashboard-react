import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/state/themeStore';
import { useTheme } from '@/ui/ThemeProvider';
import type { Theme, ThemeName } from '@/ui/tokens/contract';
import { themes } from '@/ui/themes';

const THEME_OPTIONS: readonly ThemeName[] = ['editorial', 'controlRoom', 'softDepth'];

/**
 * Placeholder landing screen for the socle milestone.
 *
 * It surfaces the mandatory client-only disclaimer, confirms the foundation is
 * wired, and lets you live-switch between the three themes — proof that the
 * tokenized system re-skins the whole app from one source of truth. Real screens
 * replace this once the design direction is finalized.
 */
export default function Home() {
  const { t } = useTranslation();
  const theme = useTheme();
  const activeName = useThemeStore((s) => s.themeName);
  const setTheme = useThemeStore((s) => s.setTheme);
  const styles = makeStyles(theme);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>{t('app.name')}</Text>

        <View style={styles.switcher}>
          {THEME_OPTIONS.map((name) => {
            const selected = name === activeName;
            return (
              <Pressable
                key={name}
                onPress={() => setTheme(name)}
                style={[styles.chip, selected && styles.chipSelected]}>
                <View style={[styles.swatch, { backgroundColor: themes[name].colors.accent }]} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {themes[name].label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('socle.title')}</Text>
          <Text style={styles.cardBody}>{t('socle.body')}</Text>
          <View style={styles.hueRow}>
            <View style={[styles.hue, { backgroundColor: theme.colors.live }]} />
            <View style={[styles.hue, { backgroundColor: theme.colors.movies }]} />
            <View style={[styles.hue, { backgroundColor: theme.colors.series }]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('disclaimer.title')}</Text>
          <Text style={styles.cardBody}>{t('disclaimer.body')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: Theme) {
  const { colors, space, radius, typography, shadow } = theme;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { padding: space.xl, gap: space.lg },
    brand: { ...typography.display, color: colors.text, marginBottom: space.xs },
    switcher: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
    swatch: { width: 14, height: 14, borderRadius: radius.sm },
    chipText: { ...typography.caption, color: colors.textMuted },
    chipTextSelected: { color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      gap: space.sm,
      ...shadow.card,
    },
    cardTitle: { ...typography.heading, color: colors.text },
    cardBody: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
    hueRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
    hue: { flex: 1, height: 6, borderRadius: radius.pill },
  });
}
