import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { favoritesRepo, profileRepo, progressRepo } from '@/data';
import { loadCredentials, saveCredentials } from '@/data/kv/credentials';
import {
  getLocale,
  getParentalPinHash,
  getThemeName,
  getTmdbApiKey,
  setLocale,
  setParentalPinHash,
  setThemeName,
  setTmdbApiKey,
} from '@/data/kv/settings';
import type { ProviderConfig } from '@/domain/provider-config';
import type { FavoriteRecord } from '@/data/repositories/favoritesRepository';
import type { ProgressRecord } from '@/data/repositories/progressRepository';

/**
 * Server-less cross-device continuity (the brief's 4th axis).
 *
 * We build a JSON snapshot of the user's *continuity* data — profiles (with
 * their credentials), favorites, watch progress, and app settings — and hand it
 * to the OS share sheet so the user saves it into THEIR OWN cloud (iCloud Drive,
 * Google Drive, Files…). Import picks that file back. The catalog itself is not
 * included: it's re-fetched per device from the provider, and because profile
 * ids are preserved, favorites/progress line back up automatically.
 *
 * No backend, nothing transmitted anywhere by us. The snapshot contains
 * credentials, so the UI warns the user to keep it in a private location.
 */

const SNAPSHOT_VERSION = 1;
const APP_TAG = 'creatictv';

interface SnapshotProfile {
  id: string;
  name: string;
  kind: 'xtream' | 'm3u';
  createdAt: number;
  lastUsedAt: number;
  lastSyncedAt: number | null;
  config: ProviderConfig;
}

export interface Snapshot {
  app: typeof APP_TAG;
  version: number;
  exportedAt: number;
  profiles: SnapshotProfile[];
  favorites: FavoriteRecord[];
  progress: ProgressRecord[];
  settings: {
    themeName: string | null;
    locale: string | null;
    parentalPinHash: string | null;
    tmdbApiKey: string | null;
  };
}

export async function buildSnapshot(): Promise<Snapshot> {
  const profiles = await profileRepo.listProfiles();
  const snapshotProfiles: SnapshotProfile[] = [];
  for (const p of profiles) {
    const config = loadCredentials(p.id);
    if (!config) continue; // can't restore a profile without its credentials
    snapshotProfiles.push({
      id: p.id,
      name: p.name,
      kind: p.kind,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
      lastSyncedAt: p.lastSyncedAt,
      config,
    });
  }

  return {
    app: APP_TAG,
    version: SNAPSHOT_VERSION,
    exportedAt: Math.floor(Date.now() / 1000),
    profiles: snapshotProfiles,
    favorites: await favoritesRepo.exportAll(),
    progress: await progressRepo.exportAll(),
    settings: {
      themeName: getThemeName(),
      locale: getLocale(),
      parentalPinHash: getParentalPinHash(),
      tmdbApiKey: getTmdbApiKey(),
    },
  };
}

export interface RestoreSummary {
  profiles: number;
  favorites: number;
  progress: number;
}

export async function restoreSnapshot(snapshot: Snapshot): Promise<RestoreSummary> {
  if (snapshot.app !== APP_TAG || typeof snapshot.version !== 'number') {
    throw new Error('Not a CreaticTV backup file.');
  }

  for (const p of snapshot.profiles) {
    await profileRepo.upsertProfile({
      id: p.id,
      name: p.name,
      kind: p.kind,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
      lastSyncedAt: p.lastSyncedAt,
    });
    saveCredentials(p.id, p.config);
  }

  await favoritesRepo.importMany(snapshot.favorites ?? []);
  await progressRepo.importMany(snapshot.progress ?? []);

  const s = snapshot.settings;
  if (s?.themeName) setThemeName(s.themeName);
  if (s?.locale) setLocale(s.locale);
  setParentalPinHash(s?.parentalPinHash ?? null);
  setTmdbApiKey(s?.tmdbApiKey ?? null);

  return {
    profiles: snapshot.profiles.length,
    favorites: snapshot.favorites?.length ?? 0,
    progress: snapshot.progress?.length ?? 0,
  };
}

/** Write a snapshot file and present the OS share sheet to save it to the cloud. */
export async function exportSnapshotToCloud(): Promise<void> {
  const snapshot = await buildSnapshot();
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `creatictv-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(snapshot));

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'CreaticTV backup',
      UTI: 'public.json',
    });
  }
}

/** Pick a snapshot file from the user's cloud/Files and restore it. */
export async function importSnapshotFromCloud(): Promise<RestoreSummary | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;

  const file = new File(result.assets[0].uri);
  const text = await file.text();
  const snapshot = JSON.parse(text) as Snapshot;
  return restoreSnapshot(snapshot);
}
