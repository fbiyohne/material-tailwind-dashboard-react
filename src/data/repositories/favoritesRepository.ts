import { and, desc, eq } from 'drizzle-orm';
import type { StreamKind } from '@/domain/models';
import { getDb } from '../db';
import { favorites } from '../schema';

/** Favorites, keyed deterministically by profile + item so toggles are idempotent. */

const favId = (profileId: string, itemId: string) => `${profileId}::${itemId}`;
const now = () => Math.floor(Date.now() / 1000);

export interface FavoriteRef {
  readonly itemId: string;
  readonly kind: StreamKind;
}

export async function isFavorite(profileId: string, itemId: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: favorites.id })
    .from(favorites)
    .where(eq(favorites.id, favId(profileId, itemId)))
    .limit(1);
  return rows.length > 0;
}

export async function addFavorite(
  profileId: string,
  itemId: string,
  kind: StreamKind,
): Promise<void> {
  await getDb()
    .insert(favorites)
    .values({ id: favId(profileId, itemId), profileId, itemId, kind, createdAt: now() })
    .onConflictDoNothing();
}

export async function removeFavorite(profileId: string, itemId: string): Promise<void> {
  await getDb().delete(favorites).where(eq(favorites.id, favId(profileId, itemId)));
}

/** Toggle and return the new favorite state. */
export async function toggleFavorite(
  profileId: string,
  itemId: string,
  kind: StreamKind,
): Promise<boolean> {
  if (await isFavorite(profileId, itemId)) {
    await removeFavorite(profileId, itemId);
    return false;
  }
  await addFavorite(profileId, itemId, kind);
  return true;
}

export interface FavoriteRecord {
  id: string;
  profileId: string;
  itemId: string;
  kind: StreamKind;
  createdAt: number;
}

/** Export every favorite (for cloud snapshot). */
export async function exportAll(): Promise<FavoriteRecord[]> {
  return (await getDb().select().from(favorites)) as FavoriteRecord[];
}

/** Import favorites from a snapshot, keeping any that already exist. */
export async function importMany(rows: readonly FavoriteRecord[]): Promise<void> {
  if (rows.length === 0) return;
  await getDb()
    .insert(favorites)
    .values(rows as FavoriteRecord[])
    .onConflictDoNothing();
}

export async function listFavorites(
  profileId: string,
  kind?: StreamKind,
): Promise<FavoriteRef[]> {
  const where =
    kind === undefined
      ? eq(favorites.profileId, profileId)
      : and(eq(favorites.profileId, profileId), eq(favorites.kind, kind));
  const rows = await getDb()
    .select({ itemId: favorites.itemId, kind: favorites.kind })
    .from(favorites)
    .where(where)
    .orderBy(desc(favorites.createdAt));
  return rows as FavoriteRef[];
}
