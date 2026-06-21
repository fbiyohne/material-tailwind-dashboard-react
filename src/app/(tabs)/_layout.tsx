import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View, type ColorValue } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';

/** Bottom tab navigator, themed. A small dot stands in for icons until the
 *  final iconography is chosen with the visual direction. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  const dot = (color: ColorValue) => (
    <View
      style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}
    />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
      }}>
      <Tabs.Screen
        name="live"
        options={{
          title: t('tabs.live'),
          tabBarIcon: ({ color }) => dot(color),
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: t('tabs.movies'),
          tabBarIcon: ({ color }) => dot(color),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: t('tabs.series'),
          tabBarIcon: ({ color }) => dot(color),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => dot(color),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => dot(color),
        }}
      />
    </Tabs>
  );
}
