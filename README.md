# Cognisaarthi

A warm digital companion for everyday memory and brain activities, built for
older adults in the North Eastern Region of India — and for the family members
who look after them.

**This repository is at Phase 7.** Phases 1–6 built the foundation, adaptive
difficulty, localisation and voice, the caregiver ecosystem, offline-first
support and a deterministic longitudinal layer. Phase 7 added consent, privacy
controls, a research-export boundary and a read-only caregiver offline
snapshot. It is not the full product, and it does not pretend to be.

---

## Architecture

| Layer | What it actually is |
|---|---|
| **Frontend** | Next.js 16 (App Router) + React 19, Tailwind v4, React Compiler on |
| **Backend** | Next.js API route handlers; every body validated with Zod |
| **Database** | PostgreSQL + Prisma 6 |
| **Cognitive intelligence** | Deterministic, rule-based longitudinal personalisation — no model, no training |
| **AI** | Optional architecture only. **No provider is configured**, and the app is fully functional without one |
| **Offline** | IndexedDB replica + service worker shell + durable sync queue |
| **Localisation** | English, Hindi and Assamese (elder interface); caregiver side is English |
| **Privacy** | Versioned research consent, retention policy, audit log, pseudonymous export |
| **Research** | Adapter architecture. **No external dataset is integrated** |

Nothing above is claimed beyond what is implemented. `datasetIntegrationStatus()`
returns `NO_DATASET_INTEGRATED` and a test asserts it.

---

## Running it

Requires Node 20+ and PostgreSQL.

```bash
npm install
```

Create `.env` from the example and point `DATABASE_URL` at a database you can
reach:

```bash
cp .env.example .env
```

> **Note for this machine:** port 5432 is held by a password-protected
> PostgreSQL instance we do not have credentials for. Development uses the
> Homebrew `postgresql@18` install on **port 5433** instead, started with:
>
> ```bash
> LC_ALL=en_US.UTF-8 /opt/homebrew/opt/postgresql@18/bin/pg_ctl -D /opt/homebrew/var/postgresql@18 -l /tmp/cognisaarthi-pg.log -o "-p 5433 -k /tmp" start
> ```
>
> The `LC_ALL` is required — without it the server aborts with
> "postmaster became multithreaded during startup".

Then set up the schema and seed the activity catalogue:

```bash
npx prisma migrate deploy && npm run db:seed
```

```bash
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (runs TypeScript) |
| `npm run typecheck` | Types only |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run db:seed` | Upserts the three activities into the `Game` table |
| `npm run db:studio` | Prisma Studio |

---

## Trying the whole flow

1. Open the app — you land on onboarding. Give a name, pick a language, press
   **Start**.
2. Play an activity from the home screen. All three work and all three store a
   scored session.
3. Open **My profile** and note the six-character **connection code**.
4. Go to `/caregiver/signup`, create an account, and enter that code.
5. The caregiver dashboard shows that person's real sessions.

The elder and caregiver sessions use separate cookies, so signing in as a
caregiver on the same device does **not** sign the elder out. That matters:
the elder has no password to sign back in with.

---

## Architecture

```
app/            routes — one page file per screen, thin
  api/          route handlers; every body validated with Zod
components/
  ui/           primitives: Button, Card, Field, Stars, EmptyState
  layout/       PageShell, ElderlyHeader, BottomNav
  elderly/      screens for the person using the app
  games/        game shell, tiles, timer, and the three activities
  caregiver/    the family-facing dashboard
lib/
  auth/         session cookies (jose) + scrypt passwords
  db/           Prisma client and the read models pages use
  game-engine/  types, definitions, difficulty, scoring, content banks
  i18n/         English / Hindi / Assamese dictionaries
  validation/   Zod schemas shared by forms and API routes
  offline/      IndexedDB replica, sync queue, conflict rules
  privacy/      consent, retention, audit, pseudonymisation, export/deletion
  research-data/ the export boundary; adapters for a dataset none is loaded
  caregiver/    access checks, alerts, and the offline snapshot
prisma/         schema, migrations, seed
docs/           offline-first, privacy-and-consent, research-data,
                caregiver-offline
```

### The game engine

A game contributes exactly three things:

1. a **definition** in `lib/game-engine/definitions.ts` — metadata plus a
   deterministic difficulty table
2. a **component** registered in `components/games/registry.ts`
3. its **own grading rule**, applied while producing round outcomes

Everything downstream is shared: `lib/game-engine/scoring.ts` turns rounds into
a score, `app/games/[gameId]/GameRunner.tsx` runs the lifecycle, and the result
screen, history and caregiver dashboard all read the same records. Adding a
fourth activity touches those two files and nothing else.

### Data model

`User` ─1:1─ `UserPreference`, ─1:n─ `GameSession` ─1:1─ `GameResult`.
`Caregiver` ─n:m─ `User` through `CaregiverLink`. `Game` is a seeded table, not
a hardcoded list.

Extension points that are real rather than decorative:

- `GameResult.rawRounds` stores per-round telemetry as JSON — the detail a
  personalisation engine will need and that a fixed column set cannot
  anticipate.
- `GameSession.clientSessionId` is a nullable unique key, so a session write is
  idempotent. That is the hook future offline replay will use.
- `CaregiverLink` is already many-to-many with its own status.

There are deliberately **no** empty `Reminder`, `Memory` or `VoiceSession`
tables. Unused tables are scaffolding, not architecture; they get added with
the features that fill them.

---

## Offline-first

Cognisaarthi is built for a region where the connection comes and goes, so the
elderly interface works without one. The rule is **local first**: an activity is
saved to the device and confirmed immediately, and reaching the server happens
in the background.

- **Games, reminders, routine, memories and history work offline.** All four
  activities are playable — their content ships inside the app bundle — and
  results are stored locally and shown at once.
- **Answers are never lost.** Finished activities and reminder answers go into a
  durable queue in IndexedDB and are pushed when the network returns, with
  bounded retries. Work that cannot be sent is *parked*, never deleted.
- **Nothing is duplicated.** Sessions de-duplicate on the client-generated
  `clientSessionId` (unique since Phase 1); reminder answers on
  `(reminderId, scheduledFor)`. No migration was needed.
- **The server stays authoritative.** It re-validates every payload, derives
  identity from the session cookie alone, and recomputes every score —
  IndexedDB is a replica and a workspace, never the source of truth.
- **The caregiver dashboard is still not cached.** This is a shared family
  tablet; a cached dashboard could be shown without a caregiver sign-in. Since
  Phase 7 there is one narrow exception — a *data-free* shell at
  `/caregiver/offline` that reads a per-caregiver snapshot from IndexedDB, so
  Cache Storage holds markup rather than anyone's data.
- **A caregiver offline is read-only, and told so.** The snapshot is dated in
  words ("Last updated 20 minutes ago"), warns once it is over 24 hours old, and
  offers no action that would need to synchronise.

Full details — cache strategies, the conflict rules, the security review and an
honest list of what still needs a connection — are in
[`docs/offline-first.md`](docs/offline-first.md) and
[`docs/caregiver-offline.md`](docs/caregiver-offline.md).

## Privacy, consent and research

Ordinary use of the product **never becomes research data on its own.** There is
an explicit, versioned consent boundary between the two, enforced in code.

- **Consent is to a version of a specific explanation**, not to an abstract idea
  of "research". If the wording changes materially, an old "yes" does not carry
  forward — the person is asked again.
- **A caregiver cannot consent for an elder.** A care relationship is not
  established legal authority, so the capability is absent rather than
  approximated. There is no `userId` field in the request schema to nominate
  someone else.
- **Withdrawal ends future eligibility and deletes nothing else.** History,
  memories and reminders are untouched.
- **The research export carries ten allowlisted fields** — bucketed durations, a
  calendar month, and an HMAC-derived participant id. No name, no memory, no
  photograph, no caregiver, no exact timestamp.
- **Pseudonymous, not anonymous**, and the documentation says so rather than
  overstating the protection.
- **There is no `/api/research/export` route**, because there is no
  research-admin role to authorise one. The service exists and is tested.

See [`docs/privacy-and-consent.md`](docs/privacy-and-consent.md) and
[`docs/research-data.md`](docs/research-data.md).

## Design system

The theme is **Warm Digital Companion** — earth tones, not screen tones. All
tokens live in `app/globals.css`.

Terracotta `#A64B2A`, tea-garden green `#2F6B5E`, marigold `#D98A2B` on warm
paper `#F7F2EA`. Every text pairing meets WCAG AA; marigold is a fill colour
only and always carries dark text. Lora for headings, Inter for interface text,
with Noto Sans Devanagari and Noto Sans Bengali loaded so Hindi and Assamese
render properly instead of falling back to tofu.

Accessibility is structural, not a checklist at the end:

- Root font size is 18px and the text-size preference scales the **whole**
  interface, because every size in the app is in `rem`.
- Elder touch targets clear 64px; the dense hard-mode grid uses square tiles
  that shrink so the whole board stays on one screen.
- Every state is carried by an icon and a word as well as a colour.
- `prefers-reduced-motion` is honoured, and there is an in-app setting for
  people who want stillness without changing their OS.
- One primary action per screen; the back control is always labelled with the
  word "Back", never a bare chevron.

---

## What is deliberately not built

Cognisaarthi makes no claim it cannot support. Specifically:

- **No AI provider is configured.** The architecture has a seam for one; there
  is no model, no inference and no chatbot behind it today, and the product is
  complete without one.
- **No external dataset is integrated.** The research adapter registry is
  empty rather than stubbed with a plausible-looking loader.
- **No diagnosis, risk score or clinical measurement.** A forbidden-phrase guard
  (`lib/intelligence/safety.ts`) is applied to generated copy and, since Phase 7,
  to the consent and privacy copy in all three languages.
- **No research export endpoint**, because there is no role that would be
  authorised to call one.
- **No account-deletion button.** The deletion service is implemented and
  tested; wiring an irreversible one-tap destruction of an elderly person's
  photographs to the profile screen needs a confirmation design this phase did
  not do.
- **Scores are not a medical measurement**, and the caregiver dashboard says so
  in plain text at the bottom of the page.

Known limits worth stating:

- Games run entirely in the browser, so round data originates on the device.
  The server recomputes the score from that data rather than trusting a
  client-supplied number, which is right for a wellbeing app but is worth
  revisiting before this data is used for anything clinical.
- Caregiver-facing copy is English only. The elderly interface is translated
  because that is where it matters most; translating the dashboard is queued
  rather than faked.
- The caregiver link is consented to by reading out a code. That is deliberately
  narrow, and it is a *different* consent from research consent — a linked
  caregiver has not thereby acquired authority to enter someone into a dataset.
- Pseudonymisation is not anonymisation. The server holds a secret that could
  re-derive a participant id for a known user, so the export is pseudonymous;
  `docs/research-data.md` says so rather than overstating it.
- Server-side deletion cannot reach a device that is offline. The local replica
  clears on sign-out and on a user switch; a device that never reconnects keeps
  its copy until one of those happens.
