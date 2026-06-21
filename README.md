# CreaticTV

A cross-platform IPTV **client** (player) built with React Native + Expo. Mobile-first
(iOS + Android, touch), with Android TV / Apple TV as a second target on the same base.

> **CreaticTV is a media player only.** It ships with **no** channels, playlists, or
> streams, and is not a content provider. You connect your **own** provider using
> credentials you already have (Xtream Codes account, or an M3U playlist + XMLTV EPG).
> Your credentials are **encrypted and stored on this device** and are only ever sent
> to your provider — never to us (there is no backend) or any third party.

## Why this exists

Inspired functionally by StreamVault and IPTV Smarters Pro, but aiming to surpass them on
four axes:

1. **Coverage** — iOS + Android with a thumb-first touch UX (not a transposed D-pad), TV second.
2. **Distinct visual identity** — a tokenized design system, not the generic dark-tile grid.
3. **On-device intelligence** — provider-data sanitation (dedup, dead-stream purge), TMDB
   enrichment, smart EPG matching, natural-language search.
4. **Server-less multi-device continuity** — via the user's own cloud (iCloud / Drive).

## Hard constraints

- **Zero backend.** 100% client. Compatibility comes from open standards providers already
  expose: Xtream Codes API, M3U/M3U8 playlists, XMLTV EPG.
- **No bundled content.** The user supplies everything.
- **Encrypted, local-only credentials.**

## Tech stack (Expo SDK 56)

| Concern | Choice |
| --- | --- |
| Framework | Expo SDK 56 · React Native 0.85 · React 19.2 (New Architecture) |
| Navigation | Expo Router (file-based, typed routes) |
| TV build | react-native-tvos + `@react-native-tvos/config-tv` |
| Video | react-native-video (Media3/ExoPlayer on Android, AVPlayer on iOS) |
| Local DB | op-sqlite (JSI, FTS5) + Drizzle ORM (typed queries) |
| Encrypted KV | react-native-mmkv (key sealed in Keychain/Keystore via expo-secure-store) |
| Lists | @shopify/flash-list v2 |
| State | Zustand |
| i18n | i18next (FR + EN) |
| Tooling | TypeScript (strict) · ESLint (eslint-config-expo) · Jest |

Minimum targets: **iOS 16.4+ / Android 8 (API 26)+**.

## Architecture (layered)

```
src/
  app/          Expo Router routes — screens only, provider-agnostic
  domain/       pure TS models (Channel, Movie, Series, EpgEntry, Profile…)
  providers/    THE abstraction: ContentProvider + XtreamProvider + M3uProvider
  data/         SQLite (schema, db, repositories, FTS5) + encrypted MMKV stores
  sync/         catalog import orchestrator (provider → normalize → SQLite, progress)
  services/     on-device intelligence (V2: dedup, health-check, TMDB, NL search)
  state/        Zustand stores
  ui/           theme system: token contract + 3 selectable themes + ThemeProvider
  lib/          parsers (M3U, XMLTV), resilient HTTP, encoding/hash utils
  i18n/         FR + EN
```

**The contract:** every screen depends only on `ContentProvider`. It never knows whether
the active source is Xtream or M3U. Adding a new source = one new class + one `case` in the
factory; nothing upstream changes. This is the technical meaning of "works with all providers".

## Status

Foundation (the *socle*) is in place and verified (typecheck + lint + unit tests green):

- ✅ Provider abstraction with Xtream + M3U implementations
- ✅ M3U and XMLTV parsers (unit-tested)
- ✅ SQLite schema + indexes + FTS5, bulk-insert repositories
- ✅ Encrypted credential storage
- ✅ Catalog import pipeline with progress events
- ✅ Tokenized theme system with **three selectable, persisted themes**:
  **Éditorial** (calm cinephile), **Control Room** (broadcast-HUD), **Soft Depth** (tactile).
  Components style only from `useTheme()`; switching re-skins the whole app from one source.
- ✅ MVP screens (all theme-driven, Expo Router): disclaimer + **onboarding**
  (Xtream/M3U with live validation) → **import progress** → **Live TV** (categories +
  virtualized list + now/next EPG) → **Movies** & **Series** (+ series detail) →
  **global Search** (FTS5) → **Settings** (theme, language, profile switch/refresh/remove)
  → full-screen **player** (react-native-video).
- ✅ Favorites, recents & **resume / continue-watching**: heart toggles on
  channels/movies/series; the player records progress and seeks back to it; Live
  shows Récents + Favoris shelves and Movies shows a "Reprendre" shelf with
  progress bars.
- ✅ **EPG grid** (`/guide`): scrollable 24h timeline with a synchronized channel
  column, "now" line, category filter, and tap-to-watch — one windowed query
  feeds the whole grid; rows are virtualized.
- ✅ **Parental control**: salted-SHA-256 PIN (hash in the encrypted store);
  locked categories prompt for the PIN; adult-flagged content is hidden until the
  session is unlocked (session-scoped, never persisted).
- ✅ **Category curation** (`/categories`): pin / hide / lock / reorder per kind;
  lists honor it (hidden excluded, pinned first); curation survives re-imports.
- ✅ **TV pass** (react-native-tvos): the active theme auto-scales for distance
  viewing (larger type/spacing, stronger focus ring); focusable primitives carry
  D-pad focus + `hasTVPreferredFocus`; on-screen channel jump on Live. TV config
  validated with `EXPO_TV=1`.

  > **Known RNTV rough edge (flagged, not hidden):** raw remote *number keys* are
  > not delivered by `useTVEventHandler`, so direct digit-to-channel zapping needs
  > a small native key listener. We ship the reliable on-screen channel jump
  > meanwhile. Build a TV dev client with `EXPO_TV=1 npx expo prebuild`.

Next: V2 differentiators — on-device intelligence (dedup, dead-stream health
check, TMDB enrichment, natural-language search), catch-up/archive, and
server-less cloud sync (iCloud / Drive).

## Develop

```bash
npm install
npx expo prebuild        # generates native projects (dev build required — not Expo Go)
npm run ios | npm run android

npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # jest
```

> A native **dev build** is required (op-sqlite, MMKV, react-native-video are native modules).
> Expo Go will not work.

## License

MIT — see [LICENSE](./LICENSE).
