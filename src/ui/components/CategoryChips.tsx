import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import type { Category } from '@/domain/models';
import { useParentalStore } from '@/state/parentalStore';
import { useTheme } from '@/ui/ThemeProvider';
import { Chip } from './Chip';

interface CategoryChipsProps {
  categories: Category[];
  /** Selected category id, or undefined for "All". */
  selected: string | undefined;
  onSelect: (categoryId: string | undefined) => void;
  accent?: string;
}

/**
 * Horizontal category filter. Locked categories show a padlock and route to the
 * PIN prompt when the session isn't unlocked, instead of selecting.
 */
export function CategoryChips({ categories, selected, onSelect, accent }: CategoryChipsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const unlocked = useParentalStore((s) => s.unlocked);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.space.sm, paddingVertical: theme.space.md }}>
      <Chip
        label={t('common.all')}
        selected={selected === undefined}
        accent={accent}
        onPress={() => onSelect(undefined)}
      />
      {categories.map((c) => (
        <Chip
          key={c.id}
          label={c.isLocked ? `🔒 ${c.name}` : c.name}
          selected={selected === c.id}
          accent={accent}
          onPress={() =>
            c.isLocked && !unlocked ? router.push('/unlock') : onSelect(c.id)
          }
        />
      ))}
    </ScrollView>
  );
}
