import { create } from 'zustand';
import { loadCredentials } from '@/data/kv/credentials';
import { initSecureStores } from '@/data/kv/secureStorage';
import { getActiveProfileId, setActiveProfileId } from '@/data/kv/settings';
import { profileRepo, runMigrations } from '@/data';
import { createProvider, type ContentProvider } from '@/providers';

/**
 * Session store: which profile (provider) is active and its live provider
 * instance. Switching profiles is just swapping this instance — the catalog is
 * already in SQLite, so the UI re-queries instantly without a network refresh.
 */
interface SessionState {
  ready: boolean;
  activeProfileId: string | null;
  provider: ContentProvider | null;
  /** Run once at app start: init encrypted stores, migrate DB, restore profile. */
  bootstrap: () => Promise<void>;
  /** Make a configured profile active. */
  switchProfile: (profileId: string) => Promise<void>;
}

function buildProvider(profileId: string): ContentProvider | null {
  const config = loadCredentials(profileId);
  return config ? createProvider(profileId, config) : null;
}

export const useSessionStore = create<SessionState>((set) => ({
  ready: false,
  activeProfileId: null,
  provider: null,

  bootstrap: async () => {
    await initSecureStores();
    await runMigrations();
    const activeId = getActiveProfileId();
    const provider = activeId ? buildProvider(activeId) : null;
    set({ ready: true, activeProfileId: provider ? activeId : null, provider });
  },

  switchProfile: async (profileId) => {
    const provider = buildProvider(profileId);
    if (!provider) throw new Error(`No credentials stored for profile ${profileId}`);
    setActiveProfileId(profileId);
    await profileRepo.touchProfile(profileId, Math.floor(Date.now() / 1000));
    set({ activeProfileId: profileId, provider });
  },
}));
