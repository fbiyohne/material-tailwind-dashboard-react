import * as Crypto from 'expo-crypto';
import { create } from 'zustand';
import { deleteProfileData, profileRepo, runMigrations } from '@/data';
import {
  deleteCredentials,
  loadCredentials,
  saveCredentials,
} from '@/data/kv/credentials';
import { initSecureStores } from '@/data/kv/secureStorage';
import { getActiveProfileId, setActiveProfileId } from '@/data/kv/settings';
import type { Profile, ProviderConfig } from '@/domain/provider-config';
import { createProvider, type ContentProvider } from '@/providers';

/**
 * Session store: the configured profiles, which one is active, and its live
 * provider instance. Switching profiles just swaps the instance — the catalog is
 * already in SQLite, so the UI re-queries instantly without a network refresh.
 */
interface SessionState {
  ready: boolean;
  activeProfileId: string | null;
  provider: ContentProvider | null;
  profiles: Profile[];

  /** Run once at app start: init encrypted stores, migrate DB, restore profile. */
  bootstrap: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  /** Create a profile from validated credentials, make it active. Returns its id. */
  addProfile: (name: string, config: ProviderConfig) => Promise<string>;
  /** Make an existing profile active. */
  switchProfile: (profileId: string) => Promise<void>;
  /** Remove a profile, its catalog, and its credentials. */
  removeProfile: (profileId: string) => Promise<void>;
}

function buildProvider(profileId: string): ContentProvider | null {
  const config = loadCredentials(profileId);
  return config ? createProvider(profileId, config) : null;
}

const now = () => Math.floor(Date.now() / 1000);

export const useSessionStore = create<SessionState>((set, get) => ({
  ready: false,
  activeProfileId: null,
  provider: null,
  profiles: [],

  bootstrap: async () => {
    await initSecureStores();
    await runMigrations();
    const profiles = await profileRepo.listProfiles();
    const activeId = getActiveProfileId();
    const provider = activeId ? buildProvider(activeId) : null;
    set({
      ready: true,
      profiles,
      activeProfileId: provider ? activeId : null,
      provider,
    });
  },

  refreshProfiles: async () => {
    set({ profiles: await profileRepo.listProfiles() });
  },

  addProfile: async (name, config) => {
    const id = Crypto.randomUUID();
    saveCredentials(id, config);
    const profile: Profile = {
      id,
      name,
      kind: config.kind,
      createdAt: now(),
      lastUsedAt: now(),
      lastSyncedAt: null,
    };
    await profileRepo.upsertProfile(profile);
    setActiveProfileId(id);
    set({
      activeProfileId: id,
      provider: createProvider(id, config),
      profiles: await profileRepo.listProfiles(),
    });
    return id;
  },

  switchProfile: async (profileId) => {
    const provider = buildProvider(profileId);
    if (!provider) throw new Error(`No credentials stored for profile ${profileId}`);
    setActiveProfileId(profileId);
    await profileRepo.touchProfile(profileId, now());
    set({ activeProfileId: profileId, provider });
  },

  removeProfile: async (profileId) => {
    deleteCredentials(profileId);
    await deleteProfileData(profileId);
    await profileRepo.deleteProfile(profileId);
    const profiles = await profileRepo.listProfiles();
    const wasActive = get().activeProfileId === profileId;
    if (wasActive) {
      const next = profiles[0] ?? null;
      setActiveProfileId(next?.id ?? null);
      set({
        profiles,
        activeProfileId: next?.id ?? null,
        provider: next ? buildProvider(next.id) : null,
      });
    } else {
      set({ profiles });
    }
  },
}));
