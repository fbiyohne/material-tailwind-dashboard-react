import { asc, eq } from 'drizzle-orm';
import type { Profile } from '@/domain/provider-config';
import { getDb } from '../db';
import { profiles } from '../schema';

/** CRUD for provider profiles (metadata only — secrets live in encrypted KV). */

export async function listProfiles(): Promise<Profile[]> {
  const rows = await getDb().select().from(profiles).orderBy(asc(profiles.lastUsedAt));
  return rows as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const rows = await getDb().select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return (rows[0] as Profile | undefined) ?? null;
}

export async function upsertProfile(profile: Profile): Promise<void> {
  await getDb()
    .insert(profiles)
    .values(profile)
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        name: profile.name,
        kind: profile.kind,
        lastUsedAt: profile.lastUsedAt,
        lastSyncedAt: profile.lastSyncedAt,
      },
    });
}

export async function touchProfile(id: string, when: number): Promise<void> {
  await getDb().update(profiles).set({ lastUsedAt: when }).where(eq(profiles.id, id));
}

export async function markSynced(id: string, when: number): Promise<void> {
  await getDb().update(profiles).set({ lastSyncedAt: when }).where(eq(profiles.id, id));
}

export async function deleteProfile(id: string): Promise<void> {
  await getDb().delete(profiles).where(eq(profiles.id, id));
}
