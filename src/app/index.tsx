import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space, typography } from '@/ui/tokens';

/**
 * Placeholder landing screen for the socle milestone.
 *
 * It shows the mandatory client-only disclaimer and confirms the foundation is
 * wired. Real screens (onboarding, live TV, …) replace this once the visual
 * direction is chosen — this is intentionally not styled as a "direction".
 */
export default function Home() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>{t('app.name')}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('socle.title')}</Text>
          <Text style={styles.cardBody}>{t('socle.body')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('disclaimer.title')}</Text>
          <Text style={styles.cardBody}>{t('disclaimer.body')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.xl, gap: space.lg },
  brand: { ...typography.title, color: colors.text, marginBottom: space.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  cardTitle: { ...typography.heading, color: colors.text },
  cardBody: { ...typography.body, color: colors.textMuted, lineHeight: 22 },
});
