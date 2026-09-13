# Research data (future use)

This folder is a **placeholder with documentation only**. It contains no
dataset, and none should ever be committed here. It exists to keep a clean
separation between two kinds of data that must never be conflated:

| | Cognisaarthi interaction data | External research data |
|---|---|---|
| **Source** | The app's own game sessions | A published cognitive-ageing study (e.g. LASI-DAD) |
| **Rows** | `GameSession` + `GameResult` in our PostgreSQL | Survey/assessment records for study participants |
| **Purpose** | Personalise activities for a living user | Understand cognitive domains; validate our approach; develop future models |
| **Contains PII?** | A first name and gameplay only | Potentially sensitive participant data under a data-use agreement |

## Why they are kept apart

The adaptive engine in `lib/cognitive-performance/` runs **entirely on
Cognisaarthi interaction data**. It never reads a clinical dataset, and no
clinical dataset column is written into `GameSession`. Mixing the two would:

- imply a clinical meaning our gameplay scores do not have;
- drag licensing and consent obligations onto our own user data; and
- make it impossible to reason about privacy for either set cleanly.

## If a dataset such as LASI-DAD is used later

LASI-DAD (the Longitudinal Ageing Study in India — Diagnostic Assessment of
Dementia) is **access-controlled**. It is obtained under a data-use agreement,
not downloaded freely, and it must not be redistributed. Any future use here
must:

1. Keep the raw files **out of the repository** (add them to `.gitignore`;
   store them outside version control entirely).
2. Never expose participant-level records through the app or any API.
3. Use the data only for **research and model validation**, offline — not to
   drive a live user's difficulty.
4. Preserve the mapping table below so external cognitive domains line up with
   Cognisaarthi's own domains conceptually, without copying any values across.

## Domain mapping (conceptual only)

| Cognisaarthi domain | Game | Broad cognitive area a study would measure |
|---|---|---|
| `SHORT_TERM_MEMORY` | Remember the Objects | Immediate/short-term recall |
| `ATTENTION` | Find the Different One | Selective attention, visual search |
| `WORKING_MEMORY` | Remember the Sequence | Working memory, sequencing |
| `LANGUAGE` *(future)* | — | Naming, fluency |
| `PROCESSING_SPEED` *(future)* | — | Speed of processing |
| `EXECUTIVE_FUNCTION` *(future)* | — | Planning, set-shifting |

## Preprocessing approach (when the time comes)

- Load raw study files from a path **outside** the repo.
- Select only the columns relevant to the domains above.
- Normalise to a documented 0–100 scale mirroring
  `lib/cognitive-performance/metrics.ts`, so the two data worlds can be
  *compared* without being *merged*.
- Keep all of it in a separate analysis workspace (notebooks/scripts), never
  in the Next.js runtime.

## Status

Nothing here is wired into the application. Phase 2 personalisation is
rule-based and uses only the app's own interaction data. This document is the
groundwork for a later, clearly-scoped research phase.
