import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { useTheme } from '@/ui/ThemeProvider';
import { fonts } from '@/ui/tokens/fonts';

type FeatherName = keyof typeof Feather.glyphMap;

function TabIcon({
  name,
  color,
  focused,
}: {
  name: FeatherName;
  color: ColorValue;
  focused: boolean;
}) {
  return <Feather name={name} size={focused ? 23 : 21} color={color} />;
}

/** Bottom tab navigator, themed, with line iconography. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.interMedium,
          fontSize: 11,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
      <Tabs.Screen
        name="live"
        options={{
          title: t('tabs.live'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="radio" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: t('tabs.movies'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="film" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: t('tabs.series'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="tv" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="settings" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
