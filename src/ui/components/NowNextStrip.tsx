import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { epgRepo } from '@/data';
import type { Channel, EpgEntry } from '@/domain/models';
import { elapsedFraction } from '@/lib/epgProgress';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (epoch: number) => {
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface NowNextStripProps {
  profileId: string | null;
  channel: Channel | null;
}

interface NowNextState {
  /** The channel this data belongs to, so stale results are ignored on zap. */
  chId: string;
  now: EpgEntry | null;
  next: EpgEntry | null;
  frac: number;
}

/** Now/next guide for the selected channel, with an elapsed progress bar. */
export function NowNextStrip({ profileId, channel }: NowNextStripProps) {
  const theme = useTheme();
  const [state, setState] = useState<NowNextState | null>(null);

  useEffect(() => {
    let active = true;
    const chId = channel?.epgChannelId;
    if (!profileId || !chId) return;
    void epgRepo
      .getNowNext(profileId, chId)
      .then((nn) => {
        if (!active) return;
        setState({
          chId,
          now: nn.now,
          next: nn.next,
          frac: nn.now
            ? elapsedFraction(nn.now.start, nn.now.end, Math.floor(Date.now() / 1000))
            : 0,
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [profileId, channel]);

  if (!channel) return null;

  // Only trust data that belongs to the currently selected channel.
  const matched = state && state.chId === channel.epgChannelId ? state : null;

  // Still loading this channel's guide — reserve no visual weight yet.
  if (!matched) return <View style={{ paddingVertical: theme.space.xs }} />;

  const { now, next, frac } = matched;

  if (!now && !next) {
    return (
      <View style={{ paddingVertical: theme.space.sm }}>
        <AppText variant="caption" muted>
          Pas de programme pour cette chaîne.
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.space.xs + 2, paddingVertical: theme.space.sm }}>
      {now ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: theme.colors.live,
              }}
            />
            <AppText variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {now.title}
            </AppText>
            <AppText variant="mono" muted>
              {hhmm(now.start)}–{hhmm(now.end)}
            </AppText>
          </View>
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: theme.colors.surfaceElevated,
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
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
    </View>
  );
}
