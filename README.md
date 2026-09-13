# Cognisaarthi

A warm digital companion for everyday memory and brain activities, built for
older adults in the North Eastern Region of India — and for the family members
who look after them.

**This repository is at Phase 1.** It is a complete, working foundation: a real
database, real authentication, three finished cognitive activities and a
caregiver view. It is not yet the full product, and it does not pretend to be.

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
prisma/         schema, migrations, seed
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

Phase 1 makes no claim it cannot support. Specifically:

- **Voice** appears on the home screen as a visibly disabled tile reading
  "Coming soon" — not a live-looking button that does nothing.
- **Memories** and **Reminders** are honest placeholder pages. They show no
  sample photographs and no example reminders.
- **Difficulty is a fixed three-row lookup table**, described to the user as
  Easy / Medium / Hard and nowhere described as adaptive or intelligent.
- **No AI of any kind.** No model, no inference, no chatbot, no prediction.
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
- The caregiver link is consented to by reading out a code. That is the whole
  of the consent model, and it is deliberately narrow.
