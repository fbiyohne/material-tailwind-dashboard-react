import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Channel, EpgEntry } from '@/domain/models';
import { elapsedFraction } from '@/lib/epgProgress';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface NowHeroProps {
  channel: Channel | null;
  now: EpgEntry | null;
  next: EpgEntry | null;
  /** Mount-time seconds (no Date.now() in render). */
  nowSecs: number;
  onPress: () => void;
}

/** "En ce moment" hero — the current programme of the selected channel. */
export function NowHero({ channel, now, next, nowSecs, onPress }: NowHeroProps) {
  const theme = useTheme();
  if (!channel) return null;
  const frac = now ? elapsedFraction(now.start, now.end, nowSecs) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          borderRadius: theme.radius.lg,
          overflow: 'hidden',
          backgroundColor: theme.colors.surfaceElevated,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.space.lg,
          opacity: pressed ? 0.9 : 1,
        },
        theme.shadow.card,
      ]}>
      {/* Channel logo as a soft backdrop. */}
      {channel.logoUrl ? (
        <Image
          source={{ uri: channel.logoUrl }}
          style={[StyleSheet.absoluteFill, { opacity: 0.08 }]}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        {now ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: theme.colors.danger,
            }}
          />
        ) : null}
        <AppText
          variant="caption"
          muted
          style={{ letterSpacing: 1, color: theme.colors.text }}>
          {now ? 'EN DIRECT' : channel.name}
        </AppText>
      </View>

      <AppText variant="title" numberOfLines={2} style={{ marginTop: theme.space.xs }}>
        {now ? now.title : 'Pas de programme en cours.'}
      </AppText>

      {now ? (
        <View style={{ marginTop: theme.space.sm, gap: 6 }}>
          <AppText variant="mono" muted>
            {hhmm(now.start)}–{hhmm(now.end)}
          </AppText>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: theme.colors.surface,
              overflow: 'hidden',
            }}>
            <View
              style={{
                width: `${Math.round(frac * 100)}%`,
                height: '100%',
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        </View>
      ) : null}

      {next ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            marginTop: theme.space.sm,
          }}>
          <AppText variant="caption" muted style={{ letterSpacing: 0.6 }}>
            À SUIVRE
          </AppText>
          <AppText variant="caption" muted numberOfLines={1} style={{ flex: 1 }}>
            {next.title}
          </AppText>
          <AppText variant="mono" muted>
            {hhmm(next.start)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
