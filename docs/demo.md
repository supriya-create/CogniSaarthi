# The demo walkthrough

Twelve minutes, no database editing, no manual setup beyond one command.

```bash
npm run db:seed:demo
npm run build && npm run start
```

The seed prints the caregiver sign-in and the elder's connection code.
Everything it creates is synthetic: the caregiver's address is on
`.example`, a domain reserved by RFC 2606 so it can never belong to
anybody, and the photographs are flat illustrations the script draws
rather than pictures of anyone.

It is idempotent and every date is relative to today, so the demo looks
current whenever it is run and can be reset between rehearsals.

---

## What the seed builds

One elder, **Ratna**, and her daughter **Meera** as caregiver.

- **A month of activities** across all three games, with a gentle
  upward arc and realistic gaps — not a perfect streak, because nobody
  lives like that. Every score is produced by `summarise()` from
  generated round data, so the demo cannot contain a score the product
  could not have produced.
- **Six memories**, deliberately at different points in the Memory Lane
  schedule:

  | Memory | State | Why it is there |
  |---|---|---|
  | Nabanita (granddaughter) | `NEW` | never practised — the first prompt |
  | Your tea flask | `LEARNING` | one recognition, still inside a sitting |
  | Anil (son) | `BUILDING` | a wobble and a recovery |
  | Meera's wedding | `BUILDING` | gaps starting to widen |
  | Meera (daughter) | `HOLDING` | recognised out to a week, now resting |
  | The house in Jorhat | `NEEDS_REINFORCEMENT` | held for a month, then needed a hand |

- **Three daily reminders** with a fortnight of answers — mostly
  acknowledged, occasionally not, so the caregiver dashboard has
  something to look at.
- Two caregiver notes, an emergency contact, and a research-consent
  decision on the record.

It does **not** seed a voice recording. See the last step below.

---

## The route

1. **Open the app.** The elder home: a greeting by name, the day's
   journey, and no score anywhere.
2. **Start Today's Journey.** Play one short activity through to the
   result screen.
3. **Note that the activity was chosen.** "Chosen for you today" — the
   plan comes from the longitudinal engine, and the elder is never
   shown the reasoning.
4. **Open Memory Lane** from the journey card.
5. **Recognise one.** A photograph, a simple question, four large
   choices.
6. **Miss the next one** — or press *"I'm not sure"*, which is the
   point: the person never has to guess wrong to find out.
7. **Watch the correction.** "Let's remember together. This is Meera.
   Your daughter." No red, no cross, no "incorrect". The round counter
   goes up by one: that memory will come back before the sitting ends,
   one step easier.
8. **Sign in as the caregiver** and open **Memory Lane** in the rail.
   The retention timeline: each memory, its history at each interval,
   and a state describing the schedule. "The house in Jorhat" is the
   one showing *Needs reinforcement*.
9. **Switch the caregiver's language** to Assamese or Hindi in
   Settings. The dashboard, the retention states and the memory manager
   all follow — and the elder's own device is untouched, because the
   language lives on the caregiver's record.
10. **Go offline** (DevTools → Network → Offline). Open Memory Lane
    again: it loads, runs, and records. The connection notice appears
    and nothing else changes.
11. **Come back online.** The queue drains; the answers given offline
    are on the server, and pushing one twice changes nothing.
12. **Open the privacy screen** on the elder side. A real consent
    decision, changeable, with a plain statement of what Cognisaarthi
    is not.

### The voice, live

The one thing worth doing by hand. On the caregiver's **Memories**
screen, press **Record** on any memory and say the sentence — "Ma, this
is Meera" — then stop.

Go back to Memory Lane as the elder, miss that memory, and the
correction offers **Hear a familiar voice**.

The seed deliberately does not fake this. A synthesised tone is not a
daughter saying somebody's name, and seeding one would be exactly the
placeholder-mistaken-for-real-data this codebase refuses to ship.
Recording it live takes five seconds and demonstrates the whole path —
private upload, authenticated playback, no public URL.

---

## Things worth saying out loud

- **Memory Lane is a practice schedule, not a treatment.** Spaced
  retrieval and errorless learning are established techniques for
  everyday memory support; this implements them, and claims nothing
  beyond that.
- **The elder is never shown a score.** No percentage, no mastery
  level, no difficulty label, no explanation of why an activity was
  chosen.
- **The caregiver sees states, not measurements.** `HOLDING` describes
  when a photograph comes round again. The page says so in its own
  words, above the list.
- **Nothing pretends to work that does not.** No Web Push, no AI
  provider, no dataset. Each is stated in the README and, where a
  person could be misled, in the interface itself.

---

## Resetting between runs

```bash
npm run db:seed:demo
```

Removes the demo family — rows *and* files — and rebuilds it. It
touches nothing else in the database; every delete is scoped to the two
demo accounts by their fixed keys.
