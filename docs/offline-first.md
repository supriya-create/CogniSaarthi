# Offline-first architecture

Cognisaarthi is built for older adults in the North East of India, where a
connection is often intermittent rather than absent. Phase 5 makes the app
useful when the network is not there, and safe when it comes back.

The governing rule is **local first**, not "try the server and show an error
page". An activity is finished, saved and confirmed on the device; reaching
the server is a background concern.

---

## 1. Architecture

```
PostgreSQL  ← authoritative, always
    ↑ push   POST /api/sync            batch operations, idempotent, authorised
    ↓ pull   GET  /api/sync/snapshot   everything this device needs
IndexedDB "cognisaarthi"  ← local replica + offline workspace
    meta · profile · games · sessions · reminders · reminderLogs · memories · queue
    ↑↓ local-first reads and writes
React client components
    ↑
Service worker  ← app shell, so the app opens with no network
```

`lib/offline/` is the whole client layer:

| Module | Responsibility |
| --- | --- |
| `types.ts` | Local entities, queue operations, snapshot contract |
| `serialization.ts` | ISO dates, plain-data payloads, client-generated ids |
| `conflicts.ts` | Deterministic reminder-answer resolution (pure) |
| `schema.ts` / `db.ts` | Object stores and a small promise wrapper over IndexedDB |
| `repositories.ts` | Typed local reads/writes and snapshot merging |
| `queue.ts` | Durable work list with bounded backoff |
| `connectivity.ts` | `ONLINE` / `OFFLINE` / `SYNCING`, confirmed by a health check |
| `sync.ts` | Push queued work, then pull a fresh snapshot |
| `actions.ts` | What the UI calls: play a game, answer a reminder, sign out |
| `useOffline.ts` | React bindings via `useSyncExternalStore` |

`lib/sync/` is the server half: `server.ts` (apply one operation) and
`snapshot.ts` (build the pull payload).

**No new runtime dependency was added.** The IndexedDB wrapper is about a
hundred lines, which this codebase prefers over another package (see AGENTS.md
rule 7). `fake-indexeddb` is a *dev* dependency, used so the storage layer is
tested against a real implementation.

## 2. IndexedDB structure

Database `cognisaarthi`, version 1. Additive upgrades only — a schema change
never drops queued activity.

| Store | Key | Contents |
| --- | --- | --- |
| `meta` | `key` | `userId`, `snapshotAt`, `contentVersion`, `lastSyncedAt` |
| `profile` | `id` | Name, language, voice, timezone, notification preferences |
| `games` | `id` | Catalogue metadata + the adaptive level chosen at snapshot time |
| `sessions` | `clientSessionId` | Games played here (indexes: `by-sync`, `by-created`) |
| `reminders` | `id` | Reminder definitions, so the day can be rebuilt offline |
| `reminderLogs` | `key` = `reminderId\|scheduledFor` | Answers given (index: `by-sync`) |
| `memories` | `id` | Memory metadata — **never image bytes** |
| `queue` | `id` | Pending operations (indexes: `by-status`, `by-created`) |

## 3. Cached entities

Cached: profile and preferences, game catalogue, reminder definitions, recent
reminder answers (7 days), memory metadata, recent history (30 sessions).

**Not cached:** passwords, tokens, any credential, caregiver records, and
memory image bytes.

Playable game content — object banks, stories, instructions, all three
dictionaries — is **statically imported and ships inside the JS bundle**. It is
therefore offline by construction and versioned by the deployment, which is why
there is no content download step.

## 4. Sync queue

A `SyncOperation` is `{ id, entityType, entityId, operation, payload, createdAt,
attempts, lastAttemptAt, status, errorCode }`.

- Entity types: `GAME_SESSION`, `REMINDER_LOG`.
- Payloads are plain data only. `toStorablePayload()` strips functions and
  class instances, so the queue can never carry executable code, and the server
  re-validates everything with Zod regardless.
- Re-answering the same reminder **replaces** its queued operation rather than
  stacking another one.

## 5. Retry strategy

Bounded exponential backoff: `0s → 2s → 10s → 30s → 2m → 10m`, capped, with
`MAX_ATTEMPTS = 6`.

| Outcome | Result |
| --- | --- |
| Network/5xx/429 | Stays `PENDING`, retried after backoff |
| 401 | `NEEDS_AUTH` — parked until sign-in, no attempts burned |
| 400/404/conflict | `FAILED` immediately (retrying cannot help) |
| Attempts exhausted | `FAILED` |

**`FAILED` means parked, not deleted.** Failed operations and their underlying
records stay in IndexedDB for inspection and recovery. User activity is never
silently discarded.

## 6. Idempotency

Synchronisation retries, so every write is safe to replay.

- **Game sessions** de-duplicate on `GameSession.clientSessionId`, a nullable
  **unique** column that has existed since Phase 1 for exactly this purpose. A
  session opened online and finished offline is *completed*, not duplicated.
- **Reminder answers** de-duplicate on the existing unique
  `(reminderId, scheduledFor)`.
- No Prisma migration was required for Phase 5.

## 7. Conflict resolution

Reminder acknowledgement is treated as an **event**, resolved in
`lib/offline/conflicts.ts` by rank → time → fixed precedence:

1. A human answer beats a system marker (`DONE`/`SKIPPED`/`SNOOZED` beat
   `MISSED`/`PENDING`) regardless of timestamps — `MISSED` is only ever inferred
   by the app.
2. A finished answer beats a postponement (`DONE`/`SKIPPED` beat `SNOOZED`), so
   an earlier "remind me later" cannot undo a later "done".
3. Between equals, the **latest genuine event** wins.
4. A dead tie is broken by fixed precedence, so every device converges.

The same pure function runs on the client (merging a snapshot) and on the
server (applying a pushed answer). Game sessions need no rule: one device
creates them, and the server's recomputed score is authoritative.

## 8. Service worker / cache strategy

| Request | Strategy |
| --- | --- |
| `/_next/static/*`, icon, manifest | Cache first (immutable) |
| Elder page navigations | Network first → cached copy → `/offline.html` |
| `/api/*` | **Never cached** (network only) |
| `/caregiver/*` | **Never cached** (network only) |

`/api` is excluded because responses are per-user and authenticated; that data
belongs in the per-user IndexedDB replica, not a shared cache. `/caregiver` is
excluded because Cognisaarthi runs on a **shared family tablet**, and a cached
dashboard could be re-displayed without a valid caregiver cookie.

Elder page HTML *is* cached — that is what lets the app open offline — and is
cleared on sign-out via a `CLEAR_CACHES` message.

### How the app shell gets cached

Next.js hashes its chunk filenames at build time, so a static `sw.js` cannot
name them in a precache list. Instead:

1. `install` precaches the fixed assets (`/offline.html`,
   `/manifest.webmanifest`, `/icon.svg`) **individually** — `cache.addAll()` is
   atomic, so one bad URL would otherwise leave the cache completely empty.
2. After `load`, the page reports the resources it actually used
   (`performance.getEntriesByType("resource")`) to the worker as `CACHE_SHELL`,
   along with its own pathname.
3. The worker re-checks **every** reported URL against its own allowlist before
   storing it. The page is not trusted: `/api/*`, `/caregiver/*` and
   cross-origin URLs are refused even if reported.

Caches: `cogni-static-v1` (precache + shell assets) and `cogni-pages-v1`
(elder page HTML).

### Offline navigation and RSC

Clicking a `<Link>` in the App Router does **not** make a document request. Next
fetches RSC/Flight data instead — `GET /home?_rsc=…` with an `RSC: 1` header and
`mode: "cors"`. That matches neither the static-asset nor the `navigate` branch,
so originally it went straight to the network and failed offline: pressing Home
landed on the fallback page.

The worker now handles it in three parts:

1. **RSC requests are intercepted and failed cleanly when offline.** They are
   never cached — the payload is authenticated and varies with the router state
   tree, so a stored copy could be replayed into the wrong state. Failing makes
   Next fall back to a full document navigation.
2. **Every supported elder route is precached as a document**, including the
   four activity routes (`/games/[gameId]`), so that fallback navigation has
   something real to land on. Previously only the page you first loaded was
   cached.
3. **`ignoreVary: true` when matching pages.** Next sends
   `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`
   on documents; honouring it means a cached page almost never matches a real
   navigation.

The visible trade-off: navigating offline is a full page load rather than a
client-side transition. It is correct and fast from cache, just not a SPA
transition.

> **Testing note:** verify the offline shell against a **production build**
> (`npm run build && npm start`). Under `next dev` the chunk URLs change on
> every rebuild and HMR needs a live socket, so dev-cached assets go stale
> immediately and are not a meaningful test of offline loading.

## 9. Security considerations

- **Identity always comes from the session cookie.** The sync schemas do not
  accept a `userId`; one sent anyway is ignored. Covered by a test.
- **Every operation is authorised individually**: a reminder must belong to the
  authenticated elder, and a `clientSessionId` already owned by someone else is
  rejected as `conflict` rather than adopted.
- **The server re-scores every session** with `summarise()`. A device cannot
  decide its own result. Covered by a test.
- **No credentials are stored locally** — no passwords, tokens or secrets in
  IndexedDB or Cache Storage.
- **Private memory images are never cached** and remain behind the existing
  authenticated route.
- **Sign-out wipes the device**: IndexedDB is cleared and all caches deleted.
- **A different elder signing in clears the previous replica** (`ensureUserScope`).
- Locally stored values render through React, which escapes by default; nothing
  uses `dangerouslySetInnerHTML`.

## 10. What works offline

- Opening the app shell, and the elder's Home, Games, Reminders, Routine,
  Memories, History, Profile and Help screens (once visited while online)
- Playing **all four** cognitive activities, at the adaptive level chosen at the
  last snapshot
- Seeing the result immediately, and keeping it
- Viewing history, including activities played offline
- Viewing cached reminders and the daily routine
- Answering reminders: Done / Later / Skip
- Viewing memory names, relationships and notes
- Language, text size, reduce-motion and voice preferences
- Text-to-speech, where the device supports it offline

## 11. What still needs a connection

- The **first** visit to any screen (there is nothing cached yet)
- Memory **photographs** (deliberately never cached — a friendly note is shown)
- **Speech recognition** — browser speech-to-text is cloud-backed
- The **entire caregiver side**, by deliberate privacy choice
- Anything reaching the server: linking a caregiver, onboarding, sign-in

## 12. Honest limitations

- There is **no background sync while the browser is closed**. Synchronisation
  happens when the app is open: on load, when the network returns, and after an
  activity. The Background Sync API is not used.
- Reminders still have **no background scheduler** (unchanged from Phase 4):
  occurrences are materialised when a reminder view is opened.
- **No push notifications, SMS, email or WhatsApp** — in-app only.
- Caregiver pages do not work offline at all; they show a plain "you're offline"
  note if the connection drops while the page is open.
- The offline fallback page (`/offline.html`) is static, so it cannot use the
  i18n dictionaries; it carries the same sentence in all three languages instead.
- If the session cookie expires while offline, queued work is parked as
  `NEEDS_AUTH` and pushed after the next sign-in. Nothing pretends to have
  synced.

## 13. Future improvements

- Background Sync / Periodic Background Sync where browsers support it
- Selective, authenticated caching of memory photos with an explicit opt-in
- A caregiver-side read-only offline snapshot
- Delta snapshots rather than a full pull
- Surfacing `FAILED` operations in a recovery screen
