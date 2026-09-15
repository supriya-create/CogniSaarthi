# Research data

## Dataset status: `NO_DATASET_INTEGRATED`

**No external dataset is integrated.** Not LASI-DAD, not anything else. There
is an adapter architecture with an empty registry, and that is all.

`datasetIntegrationStatus()` in `lib/research-data/adapters.ts` is the single
source of truth for what may be claimed publicly. It returns
`NO_DATASET_INTEGRATED`, and a test asserts it — so this document and the code
cannot drift apart on this particular question.

The registry is deliberately empty rather than stubbed with a plausible-looking
loader. Invented rows would make the product appear research-backed while being
nothing of the sort.

No model is trained on anything, here or elsewhere. The personalisation that
actually ships (Phase 2 adaptive difficulty, Phase 6 longitudinal) is rule-based
and uses only the app's own interaction data.

---

## Two different things called "research data"

| | **Cognisaarthi research export** | **External study dataset** |
|---|---|---|
| Source | The app's own game sessions | A published cognitive-ageing study |
| Direction | Data going **out**, minimised | Data that would come **in** |
| Status | Implemented (§2 below) | Not integrated |
| Consent | The user's own, versioned | A data-use agreement |
| Code | `export.ts`, `export-service.ts` | `adapters.ts`, `normalization.ts`, `types.ts` |

They are kept apart because conflating them would imply a clinical meaning our
gameplay scores do not have, and would drag one set's licensing obligations onto
the other. See `lib/research-data/README.md` for the inbound side.

---

## 1. Consent dependency

Nothing is exported for anyone without an explicit, current, un-withdrawn
"yes". The exporter checks, in this order:

1. **No pseudonymisation secret configured** → refuse outright (throws).
2. **No current consent** → zero records, `skippedReason: "no_consent"`.
3. **Withdrawn** → zero records, `skippedReason: "consent_withdrawn"`.
4. **Consented to older wording only** → zero records,
   `skippedReason: "consent_superseded"`.

"This person has not consented" is a normal outcome of a cohort export, not an
error — so it returns an empty export rather than throwing. A missing secret
*does* throw, because that is a deployment fault and continuing would mean
emitting identifiers that are not really pseudonymous.

### The consented window

Consent is neither retroactive nor perpetual. A session is eligible only if:

```
consentedAt ≤ occurredAt  AND  (withdrawnAt is null OR occurredAt < withdrawnAt)
```

Activity from before consent was given is excluded. Activity from after
withdrawal is excluded. Withdrawing therefore stops future activity from being
included, without touching the product history.

---

## 2. What is exported

Exactly ten fields, and no others:

```
anonymousParticipantId    32-char HMAC digest
domain                    SHORT_TERM_MEMORY | ATTENTION | …
gameType                  e.g. "remember-objects"
difficulty                EASY | MEDIUM | HARD
accuracy                  0–1, 2 decimal places
completion                0–1, 2 decimal places
hintRate                  0–1, per answered item
sessionDurationBucket     "<30s" | "30-60s" | "1-2m" | "2-5m" | "5m+"
timestampBucket           "2026-09"  (calendar month, UTC)
consentVersion            "research-consent-v1"
```

### Allowlist, not denylist

A record is **built** from permitted fields rather than being a product row with
sensitive columns stripped off it. The stripping approach fails silently the day
someone adds a column; this one fails loudly. `buildExportRecord` takes an
`ExportableSession` type that has no way to accept a name, an email, a caregiver
or a memory — the type will not allow one.

---

## 3. What is never exported

| Excluded | Why |
|---|---|
| `userId`, session ids | Direct identifiers |
| Name, email, phone, connect code | Direct identifiers |
| Caregiver id, caregiver name, notes | Third-party data, and free text |
| **Personal memories entirely** — photos, titles, relationships, descriptions | The most sensitive data in the product. Never justified by an activity analysis. |
| Reminders, alerts, emergency contacts | Not relevant to the question, and sensitive |
| Exact timestamps (`startedAt`, `completedAt`) | Reveal daily routine — when someone wakes, when they are alone |
| Exact durations (`durationMs`) | Distinctive; combined with a timestamp, close to a fingerprint |
| Timezone, location | Not collected for research at all |
| Tokens, password hashes | Never leave the system in any form |

The export service does not *filter these out* — it never loads them. Memories,
notes, reminders, alerts and contacts are not read by `export-service.ts` at all.

---

## 4. Pseudonymisation — honest terminology

The exported identifier is `HMAC-SHA256(secret, "purpose:userId")`, truncated to
32 hex characters.

**This is pseudonymisation, not anonymisation.** The distinction is not
pedantry and the code refuses to blur it:

- **The secret exists.** Whoever holds it can re-derive the participant id for a
  known user id and confirm a match. That is a re-identification path.
- **Linkage survives by design.** An analysis needs to know that forty records
  came from the same person; otherwise every row is falsely an independent
  observation. A long enough behavioural sequence can be distinctive even
  without a name attached.

Calling this "anonymised" would overstate the protection to the person
consenting. The consent copy therefore says *"not linked to your name"*, which
is true, rather than *"anonymous"*, which is not.

### Purpose namespacing

`participantId(userId, purpose)` includes the purpose in the HMAC input, so the
same person carries a **different** id in two different exports. Without that,
two datasets released separately could be joined on the identifier, recombining
exactly the linkage each export was minimised to avoid.

### The secret

`RESEARCH_EXPORT_SECRET`, minimum 32 characters, **separate from
`AUTH_SECRET`**. Key separation matters both ways: rotating session signing must
not silently re-pseudonymise an entire cohort, and a leaked session secret must
not hand over the identity mapping.

If it is absent or too short, export is disabled and throws
`MissingPseudonymSecretError`. There is no fallback — a fallback would produce
ids that look pseudonymous and are not.

---

## 5. Data minimisation

| Raw | Exported | Why |
|---|---|---|
| `durationMs: 45231` | `"30-60s"` | "Short or long?" is the real question |
| `completedAt: 2026-09-14T06:30:00Z` | `"2026-09"` | A month shows change over time; an instant shows daily routine |
| `accuracy: 0.7499999` | `0.75` | More precision is spurious and more distinctive |

Bucket boundaries fall on the lower bucket (`30_000ms → "30-60s"`), and negative
durations are handled rather than thrown on.

---

## 6. Validation

Every record is parsed by `researchExportRecordSchema` before it is emitted.
The schema is `.strict()`, which is load-bearing: a record carrying so much as
an extra `name` key **fails validation** rather than being quietly exported.
That is the difference between a privacy boundary and a privacy intention.

Invalid records are **dropped and counted**, never repaired and never passed
through. A record that fails this schema is either malformed or carrying a field
it should not have, and neither is something to fix up on the way out.

`containsForbiddenField()` is a second, independent check — redundant with
`.strict()` on purpose, so a future schema edit that adds a thoughtless field
has something pointing at it.

Rejection reasons name the offending key (`unrecognized_keys [phone]`), because
when a record is rejected for carrying an extra field, the name of that field is
the whole point.

---

## 7. Authorization — no HTTP surface

**There is no `/api/research/export` route, and that is intentional.**

There is no research-admin role in Cognisaarthi today. An export endpoint whose
only protection is "nobody knows the URL" is not protected, and building a fake
admin UI to sit in front of it would be worse. So:

- the service exists (`lib/research-data/export-service.ts`),
- it is tested (23 assertions across two files),
- and it is callable only from a server context by someone who already has
  database access.

A test walks `app/api` and asserts no directory matching `/research|export/i`
exists. When a real authorized role exists, that is the moment to add a route.

---

## 8. Research export and AI are separate concerns

The Phase 6 AI layer is optional and has no provider configured. Phase 7 did not
add one.

**No exported record is handed to a model.** `export-service.ts` imports nothing
from `lib/intelligence/ai.ts` and produces a value returned to its caller.
Consenting to research use is not consenting to having your data sent to an
external AI provider, and the two are not coupled anywhere in the codebase.

---

## 9. Audit

A cohort export writes one `RESEARCH_EXPORT_GENERATED` event with counts only:
participants, records, rejects, consent version. Never which participants, and
never a row of the export itself.

(The count field is named `recordCount`, not `records` — `sanitiseDetail` strips
anything called `records` outright, because it cannot tell a count from the rows
themselves, and refusing both is the right way round for a guard to be wrong.)
