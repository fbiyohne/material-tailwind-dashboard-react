import type { EpgEntry } from '@/domain/models';
import { fnv1a } from '@/lib/hash';
import { parseXmltv } from '@/lib/parsers/xmltv';
import type { ContentProvider } from '@/providers';
import { ProviderError } from '@/providers';
import { catalogRepo, profileRepo } from '@/data';
import type { SyncOptions, SyncProgress } from './types';

/**
 * Catalog import orchestrator.
 *
 * Pulls everything a provider offers, normalizes it (already done inside the
 * provider) and writes it to SQLite in bulk, emitting progress for the
 * onboarding screen. Provider-agnostic: it only ever touches ContentProvider.
 *
 * Note: heavy CPU work (XMLTV parsing of huge guides) is the next thing to move
 * off the JS thread; the seam is here (parseXmltv call) and the public contract
 * won't change when it does.
 */
export async function importCatalog(
  provider: ContentProvider,
  options: SyncOptions = {},
): Promise<void> {
  const { signal, onProgress, skipEpg = false } = options;
  const profileId = provider.profileId;
  const emit = (p: SyncProgress) => onProgress?.(p);
  const ensureLive = () => {
    if (signal?.aborted) throw new ProviderError('cancelled', 'Import cancelled');
  };

  try {
    emit({ phase: 'authenticating', progress: 0.02 });
    await provider.authenticate(signal);
    ensureLive();

    // --- Live -------------------------------------------------------------
    emit({ phase: 'live', progress: 0.05 });
    const [liveCats, channels] = await Promise.all([
      provider.getLiveCategories(signal),
      provider.getLiveChannels(signal),
    ]);
    ensureLive();
    await catalogRepo.replaceCategories(profileId, 'live', liveCats);
    await catalogRepo.replaceChannels(profileId, channels);
    emit({ phase: 'live', progress: 0.3, detail: `${channels.length}` });

    // --- VOD --------------------------------------------------------------
    emit({ phase: 'vod', progress: 0.35 });
    const [vodCats, movies] = await Promise.all([
      provider.getVodCategories(signal),
      provider.getVod(signal),
    ]);
    ensureLive();
    await catalogRepo.replaceCategories(profileId, 'movie', vodCats);
    await catalogRepo.replaceMovies(profileId, movies);
    emit({ phase: 'vod', progress: 0.55, detail: `${movies.length}` });

    // --- Series -----------------------------------------------------------
    emit({ phase: 'series', progress: 0.6 });
    const [seriesCats, seriesList] = await Promise.all([
      provider.getSeriesCategories(signal),
      provider.getSeries(signal),
    ]);
    ensureLive();
    await catalogRepo.replaceCategories(profileId, 'series', seriesCats);
    await catalogRepo.replaceSeries(profileId, seriesList);
    emit({ phase: 'series', progress: 0.7, detail: `${seriesList.length}` });

    // --- EPG --------------------------------------------------------------
    if (!skipEpg) {
      emit({ phase: 'epg', progress: 0.72 });
      const xml = await provider.getFullEpgXmltv(signal);
      if (xml) {
        ensureLive();
        const guide = parseXmltv(xml);
        const entries: EpgEntry[] = guide.programmes.map((p) => ({
          id: `${profileId}:epg:${fnv1a(`${p.channelId}|${p.start}`)}`,
          profileId,
          epgChannelId: p.channelId,
          title: p.title,
          description: p.description,
          start: p.start,
          end: p.end,
        }));
        await catalogRepo.replaceEpg(profileId, entries);
        emit({ phase: 'epg', progress: 0.9, detail: `${entries.length}` });
      }
    }

    // --- Search index -----------------------------------------------------
    emit({ phase: 'indexing', progress: 0.93 });
    await catalogRepo.rebuildSearchIndex(profileId);

    await profileRepo.markSynced(profileId, Math.floor(Date.now() / 1000));
    emit({ phase: 'done', progress: 1 });
  } catch (error) {
    const pe = ProviderError.from(error);
    emit({ phase: 'error', progress: 0, error: pe.message });
    throw pe;
  }
}
