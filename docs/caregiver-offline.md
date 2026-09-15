# Caregiver offline

A caregiver can look at a **read-only, clearly-dated copy** of their elder's
recent picture without a connection. It is not the elder's offline mode, and it
is not pretending to be live.

---

## 1. Why this is narrower than the elder experience

The elder experience is offline-**first**: activities are played, scored, saved
and queued with no network, and IndexedDB is a working store.

The caregiver experience is a **photograph of a moment**. A caregiver reading a
stale dashboard and believing it is current is worse than a caregiver who cannot
see a dashboard at all — they might conclude a reminder was answered when it was
not. So staleness is never implicit, and nothing is writable.

---

## 2. What is cached

`CaregiverSnapshotData`, built server-side in `lib/caregiver/snapshot.ts`:

| Included | Detail |
|---|---|
| Elder display info | Name, avatar id, relationship from the link |
| Today's summary | Activities completed/goal, reminders acknowledged/total, average score |
| Recent activities | Up to 8: game name, difficulty, score, stars, when, status |
| Reminder status | **Category, time and status only** |
| Recent alerts | Up to 5: severity, title, body, when, unread |
| Trends | Per played domain: direction and the Phase 6 confidence |
| Timestamps | `generatedAt`, `expiresAt`, `snapshotVersion` |

### What is deliberately NOT cached

| Excluded | Why |
|---|---|
| **Memory photographs and descriptions** | The most sensitive data in the product. A caregiver's offline convenience does not justify persisting a family album to a shared tablet's disk. |
| **Emergency contact names and numbers** | Nothing about the dashboard needs them offline, and a phone number in IndexedDB is a phone number anyone with the device can read. |
| **Caregiver note bodies** | Free text written about a person. |
| **Reminder titles** | A medication reminder's title can name a medication. The offline question is *"were today's reminders answered?"*, which category + time + status answers completely. |
| **Any credential, token or cookie** | Ever. |

A test creates an elder with a reminder titled `"Metformin 500mg"`, a memory
photo, a note and an emergency contact, then asserts none of them appear
anywhere in the serialised snapshot.

---

## 3. Security

### The server decides who the elder is

`buildCaregiverSnapshot(caregiverId)` takes a caregiver id **and nothing else**.
It does not accept an elder id, does not read one from a request body, and does
not read one from a URL. The elder is resolved here from the caregiver's own
`ACTIVE` link, by the same `getCaregiverOverview` the online dashboard uses.

**There is no parameter a caller could forge.** Caregiver A linked to Elder A
cannot describe Elder B to this function, because the function does not ask.

`GET /api/caregiver/snapshot` takes no query string and no body. Identity comes
from the caregiver session cookie. No link → 404, not somebody else's data. A
revoked link stops producing a snapshot immediately.

### The client checks too

`refreshCaregiverSnapshot` compares the response's `caregiverId` against who the
client is authenticated as and discards a mismatch rather than displaying it.
`getCaregiverSnapshot` removes a row belonging to anyone else rather than
quietly skipping it.

### Cache Storage

The caregiver **dashboard** is still never cached — a cached dashboard could be
re-displayed without a valid caregiver cookie on a shared family tablet.

Phase 7 added **one narrow exception**: `/caregiver/offline`, matched with `===`
and never as a prefix. That route's server render contains no elder name, no
scores and no alerts — it is a shell. All content is read client-side from
IndexedDB. So Cache Storage holds markup, not data, and the rule stands: no
per-user caregiver content ever reaches it.

That page does not call `requireCaregiver()`, because a cacheable page must
render identically for everyone. Access control has not moved to the client — it
happened on the **server** when the snapshot was issued. The page can only show
what this device was already authorised to hold; someone with no snapshot sees
an empty state.

---

## 4. Storage

`caregiverSnapshot` store in the **existing** `cognisaarthi` IndexedDB database
(`DB_VERSION` 2, additive upgrade), keyed by `caregiverId`.

In the same database rather than a second one, deliberately: a separate database
would need its own open/upgrade/clear handling and — worse — its own sign-out
path, which is exactly the kind of thing that gets forgotten and leaves one
person's data on a shared tablet. One database means one `clearAll()`.

Elder and caregiver data are not mixed: this store is written only from
caregiver pages and scoped by caregiver id, while every other store is scoped by
the elder in `meta.userId`.

---

## 5. Staleness

`snapshotFreshness()` returns one of four states:

| State | When | Message |
|---|---|---|
| `FRESH` | < 15 minutes | "Showing information saved earlier. Last updated 2 minutes ago." |
| `STALE` | 15 min – 24 h | Same wording, older age |
| `EXPIRED` | ≥ 24 hours | "… **This information may be out of date.**" |
| `INCOMPATIBLE` | Version mismatch or corrupt date | "Saved information could not be read. Reconnect to see the latest." |

All wording comes from `stalenessMessage()`, centralised so it cannot drift
between surfaces — and so a test can assert that **no message ever contains
"live", "right now", "real-time", "current as of" or "up to date"**. That single
test is what makes a stale caregiver view safe at all.

Ages go vague past a day ("more than a day ago"): a precise age for a snapshot
that old implies a precision the underlying figures do not have.

`INCOMPATIBLE` is not silently upgraded and not silently shown. Guessing at the
meaning of a shape we no longer define is how a caregiver ends up reading last
month's numbers as today's.

### Expiration keeps rather than deletes

An expired snapshot is **flagged, not removed**. Deleting it would leave the
caregiver with an empty screen; the last known state, clearly labelled as old,
is more use than nothing — as long as the age is stated, which it always is.

---

## 6. Read-only, and why

Offline caregivers can **view** the snapshot, trends, recent activity and
reminder status. They cannot create or delete reminders, edit notes, change
emergency contacts or change settings.

This is a decision, not an omission. A reminder created offline and pushed an
hour later could fire in the past, or collide with an edit another caregiver
made in the meantime — and unlike a game score, there is no natural idempotency
key that makes "create this reminder" safely replayable. Until that is designed
properly, offline caregiver is read-only.

There are no caregiver entries in the sync queue, and no function in
`lib/offline/caregiver-store.ts` creates one.

---

## 7. Account switching and sign-out

| Event | Effect |
|---|---|
| Caregiver B signs in where A's snapshot is stored | `ensureCaregiverScope` clears the store before writing B's |
| Caregiver signs out | `clearCaregiverSnapshots()` removes every snapshot and forgets `meta.caregiverId` — **before** the cookie is dropped, so a partial failure leaves the account signed in with data gone rather than signed out with data present |
| A different **elder** signs in | `clearAll()` also clears this store — broader than strictly necessary, and kept that way: over-clearing on a shared device costs one re-fetch; under-clearing leaves a readable copy of somebody's day behind |

---

## 8. Limitations

- **Reaching the saved view is deliberate, not automatic.** An offline
  caregiver gets there through the "Open the saved view" link in the offline
  banner, or by opening `/caregiver/offline` directly. A service-worker redirect
  from `/caregiver` was tried and removed: with the dashboard already in the
  tab's session history, Chrome restores that entry without consulting the
  worker, so the redirect did not reliably fire in testing. It is better to have
  one path that verifiably works than two where one sometimes does.
- **Read-only.** See §6.
- **Reminder titles are absent**, so the offline reminder list reads
  "Medication — 8:00 am — done" rather than naming the reminder. A deliberate
  trade of detail for safety.
- **No background refresh.** The snapshot is taken when a caregiver visits the
  dashboard online. There is no periodic sync, so a caregiver who has not opened
  the dashboard in three days has a three-day-old snapshot — labelled as such.
- **Caregiver copy is English only**, matching the rest of the caregiver side.
  The elder interface is translated because that is where it matters most.
- **One elder per caregiver.** The snapshot describes the caregiver's oldest
  active link, mirroring the online dashboard's existing behaviour.

---

## 9. Where the code is

| Path | What |
|---|---|
| `lib/caregiver/snapshot-types.ts` | Shape, freshness, staleness wording. Pure. |
| `lib/caregiver/snapshot.ts` | Server-side builder. Caregiver id only. |
| `lib/offline/caregiver-store.ts` | IndexedDB read/write, scoping, refresh. |
| `app/api/caregiver/snapshot/route.ts` | The only HTTP surface. No parameters. |
| `app/caregiver/offline/page.tsx` | The data-free cacheable shell. |
| `components/caregiver/CaregiverOfflineView.tsx` | The read-only view. |
| `components/caregiver/SnapshotSync.tsx` | Takes the snapshot while online. |
| `public/sw.js` | `CAREGIVER_OFFLINE_PAGE` — the one exception. |
