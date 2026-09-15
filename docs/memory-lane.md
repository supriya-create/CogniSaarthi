# Memory Lane

Spaced retrieval with errorless learning, over the photographs and
people a caregiver has added to the Personal Memory Bank.

**What it is:** a practice schedule. It shows somebody a personally
meaningful photograph at gradually widening gaps, and widens the next
gap when they recognise it.

**What it is not:** a treatment, a diagnosis, a therapy, or a
measurement of anybody's memory. No screen in the product says
otherwise, and `lib/intelligence/safety.ts` is applied to every string
Memory Lane can render — in all three languages — by a test.

---

## The schedule

`lib/memories/retrieval.ts`. Pure TypeScript: no React, no Prisma, no
network, and no clock of its own. Every function that depends on "now"
is handed it. That is what lets the same code run on the server and on
a device that has been offline for a week and still agree about when a
memory is next due.

```
20 seconds → 1 minute → 5 minutes → 1 day → 3 days → 7 days → 14 days → 30 days
```

The first three are measured in seconds and minutes on purpose. The
first successful recall has to happen while the answer is still
reachable, otherwise the first experience of the feature is a failure.

| Outcome | Step | Next prompt |
|---|---|---|
| `RECOGNISED` | +1, capped at 30 days | after the new, longer interval |
| `ASSISTED` | −1, floored at 20 seconds | after the *first* interval |
| `NOT_RECOGNISED` | −1, floored at 20 seconds | after the *first* interval |
| `SKIPPED` | unchanged | after the first interval |

Two rules in that table matter more than they look:

- **A miss steps back one interval, never to the beginning.** Somebody
  who has recognised their daughter at seven days and misses once at
  fourteen goes back to seven, not to twenty seconds.
- **`SKIPPED` does not move the schedule at all.** "I'd rather not" is
  not evidence about memory, and treating it as one would quietly turn
  a preference into a record of failure.

State is **derived** from the events, never stored. A stored copy would
be a second source of truth that a device offline for a week is
guaranteed to disagree with.

---

## Errorless learning

Nobody is ever told they were wrong.

- **No red anywhere.** A test reads `MemoryLane.tsx` and fails if
  `border-error`, `bg-error`, `text-error` or `error-soft` appears in
  it. A red border on the option somebody chose is the same message as
  the word "wrong", delivered faster.
- **"I'm not sure" is a first-class button**, beside the options. The
  whole point of errorless learning is that somebody should not have to
  guess wrong to find out. Pressing it records `ASSISTED` — neither a
  right answer nor a wrong one.
- **The answer is supplied warmly.** "Let's remember together. This is
  Meera. Your daughter." — with the caregiver's own recorded voice if
  there is one, and the app's text-to-speech if not.
- **The memory comes back**, once, later in the same sitting, rebuilt
  one step easier. An immediate repeat would be a copying exercise;
  a few prompts later it is a real recall with the answer still in
  reach. (`appendRepeat` in `lib/memories/lane.ts`.)

---

## Presentation modes

Chosen by the schedule step, never at random, so the same memory at the
same step is always asked the same way. Below step 3 — before a memory
has survived an interval measured in days — every prompt is plain
recognition with the photograph in view.

| Mode | Prompt | Photo shown first |
|---|---|---|
| `PERSON_RECOGNITION` | "Who is this?" | yes |
| `PLACE_RECOGNITION` | "Do you remember this place?" | yes |
| `CONTEXT_RECALL` | "Do you remember this?" / "What is this?" | yes |
| `NAME_RECALL` | "What is your daughter's name?" | **no** — it would be the answer |
| `RELATIONSHIP_RECALL` | "Meera is your…" | yes |

Randomising this would mean somebody's first ever prompt about a
photograph could be the hardest one, which is the opposite of what
errorless learning is for.

---

## Events

Memory Lane records through the **existing** `MemoryRecallEvent`
architecture rather than a second one. Phase 8 added two nullable
columns and one enum value:

- `outcome += ASSISTED` — the errorless correction. A third value
  rather than a flavour of `NOT_RECOGNISED`, because the two are
  different facts: one is "they chose the wrong one", the other is "we
  did not make them choose at all". Once merged they could never be
  separated again.
- `presentation` — which shape of question was asked. Nullable, because
  events written before Memory Lane existed were not recorded with one,
  and back-filling a value nobody observed would be inventing data.
- `intervalStep` — the step the prompt was *presented at*. A fact about
  a moment that has passed, not a running total.

`clientEventId` remains the idempotency key. A replayed push updates
nothing and creates nothing, so a flaky connection cannot inflate how
often somebody was asked — which is precisely the signal the schedule
depends on.

---

## The familiar voice

`MemoryAudio`, a separate model rather than an `audioPath` column on
`PersonalMemory`. A recording has facts of its own that a path column
cannot carry: *which* caregiver recorded it (a family may have three),
its format, its length, when it was made. It also has its own
lifecycle — replacing or deleting the voice must not be an edit to the
memory row.

Storage follows the image rule exactly:

- bytes live outside the web root, under `./storage/memory-audio`;
- `path` is a bare filename, and the reader refuses anything else;
- the only way to read one is `GET /api/memories/[id]/audio`, which
  returns it to the elder it belongs to or a linked caregiver and 404s
  for everybody else — including for "no recording" and "no such
  memory", so an id cannot be probed;
- `Cache-Control: private, no-store`, and the service worker never
  caches `/api` at all.

There is no second voice architecture. When no recording exists, the
correction falls back to the existing `useVoice` text-to-speech.

---

## Caregiver retention states

`NEW → LEARNING → BUILDING → HOLDING`, with `NEEDS_REINFORCEMENT` when
something that had reached HOLDING has since needed a hand.

These are **product states describing the schedule**, not clinical ones.
"Needs reinforcement" means Memory Lane will show that photograph more
often; it does not mean anybody is getting worse, and the copy under
the list says so in as many words.

`NEEDS_REINFORCEMENT` requires *both* that the memory genuinely reached
the holding step at some point *and* that the most recent prompt needed
help. Without the peak check, a memory somebody has never recognised
would be reported as needing reinforcement — which says something
untrue about a photograph nobody has practised yet.

### Alerts

At most **one alert per week**, however many memories slipped, reusing
`AlertType.PERFORMANCE_CHANGE` at `INFO` severity. A memory stepping
back one interval is an ordinary part of spaced retrieval — it is what
the schedule is *for* — and an alert for each one would teach a
caregiver to ignore the list, including on the day it matters.

The title names the app as the actor, not the person: "A memory is
being shown more often", never "Memory deterioration detected".

---

## Offline

Memory Lane reuses the Phase 5 offline architecture unchanged.

- The page is in the service worker's cacheable list and is fetched
  ahead of time by `OfflineProvider`, so it opens with no connection.
- The **sitting is built on the client**, at the moment Start is
  pressed, folding the answers held on this device into the history the
  server sent. Without that, a sitting played offline this morning
  would be invisible to the one played this afternoon.
- Answers are written locally and queued. Nothing about recording an
  answer reaches the screen — no spinner, no tick, no error.
- The snapshot carries recall history down, so the schedule survives a
  device change. It carries a `hasAudio` flag, never the recording.
- Coming back online clears the queue's backoff before pushing, so work
  that failed repeatedly during an outage does not sit waiting out a
  ten-minute timer against a connection that has demonstrably returned.

---

## Notifications

`MEMORY_LANE_DUE`, through the existing service-worker notification
system. No Web Push — a fully closed browser is not reached, and the
profile screen says so beside the switch.

The payload is content-free by construction: `buildSafeNotification`
takes a kind and a dictionary, and there is no parameter through which
a name, a relationship or a photograph could be passed.

```
✓ "Your Cognisaarthi activity is ready."
✗ "Remember that Meera is your daughter."
```

One notification per six hours at most. Memory Lane's own schedule
makes something due again twenty seconds after a missed prompt, and
without that floor a quiet afternoon would produce a banner every five
minutes.

---

## Trying it

```bash
npm run db:seed:demo
```

Builds one synthetic family with a month of history: six memories at
different points in the schedule (one `HOLDING`, one
`NEEDS_REINFORCEMENT`, one never practised), a month of activities,
three daily reminders with a fortnight of answers, caregiver notes and
a consent decision on the record. Idempotent, and every date is
relative to today.

It deliberately does **not** seed a voice recording. A synthesised tone
is not a daughter saying "Ma, this is Meera", and seeding one would be
the placeholder-mistaken-for-real-data this codebase refuses to ship.
Record one live from the caregiver's Memories screen instead — it takes
five seconds and demonstrates the whole path.
