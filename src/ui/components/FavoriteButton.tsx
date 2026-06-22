import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { favoritesRepo } from '@/data';
import type { StreamKind } from '@/domain/models';
import { useTheme } from '@/ui/ThemeProvider';
import { AppText } from './AppText';

interface FavoriteButtonProps {
  profileId: string | null;
  itemId: string;
  kind: StreamKind;
  size?: number;
  /** Darken hit area for overlay use (e.g. on a poster). */
  overlay?: boolean;
}

/** Self-managing favorite toggle (heart). Reads its own state and persists. */
export function FavoriteButton({
  profileId,
  itemId,
  kind,
  size = 18,
  overlay,
}: FavoriteButtonProps) {
  const theme = useTheme();
  const [fav, setFav] = useState(false);

  useEffect(() => {
    let active = true;
    if (!profileId) return;
    void favoritesRepo.isFavorite(profileId, itemId).then((v) => {
      if (active) setFav(v);
    });
    return () => {
      active = false;
    };
  }, [profileId, itemId]);

  return (
    <Pressable
      hitSlop={8}
      disabled={!profileId}
      onPress={() => {
        if (!profileId) return;
        void favoritesRepo.toggleFavorite(profileId, itemId, kind).then(setFav);
      }}
      style={{
        padding: 6,
        borderRadius: theme.radius.pill,
        backgroundColor: overlay ? 'rgba(0,0,0,0.45)' : 'transparent',
      }}>
      <AppText
        style={{
          fontSize: size,
          color: fav ? theme.colors.accent : overlay ? '#fff' : theme.colors.textMuted,
        }}>
        {fav ? '♥' : '♡'}
      </AppText>
    </Pressable>
  );
}
