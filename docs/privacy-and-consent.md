# Privacy and consent

How Cognisaarthi treats a person's data: what it keeps, why, for how long, and
what they get to decide.

The short version: **ordinary use of the product never becomes research data on
its own.** There is a consent boundary between the two, and it is enforced in
code rather than in policy.

---

## 1. Data categories

| Category | What it is | Purpose | Contains |
|---|---|---|---|
| **Profile** | Name, avatar, language, connect code | Greeting the person, letting a caregiver link | A first name |
| **Preferences** | Text size, voice, timezone, difficulty | Accessibility and gameplay | Nothing identifying |
| **Game sessions** | Each activity played, and its scored result | History, adaptive difficulty, the longitudinal view | Gameplay only |
| **Reminders** | Definitions and dated occurrences | The daily routine | Caregiver-written titles, which may be health-adjacent |
| **Personal memories** | People, places, things, moments — with photographs | Memory assistance | **The most sensitive data in the product** |
| **Caregiver notes** | Free-text observations | Caregiver support | Whatever the caregiver wrote |
| **Emergency contacts** | Name and phone number | One-tap calling | Third-party personal data |
| **Alerts** | Neutral caregiver signals | Attention, never diagnosis | Generated, non-medical copy |
| **Research consent** | One decision per consent version | Deciding research eligibility | A version, a flag, two dates |
| **Audit events** | That a sensitive thing happened | Answering questions later | Counts and ids — never content |

### What Cognisaarthi never stores

No passwords for elders (they have none — see `lib/auth/session.ts`). No
location. No contacts list. No health records. No device identifiers. No
analytics or advertising identifiers of any kind.

---

## 2. The consent boundary

```
Product data                     Research representation
──────────────                   ───────────────────────
Game sessions        ──┐
Reminders            ──┤                 ┌── domain
Personal memories    ──┤   consent       │── gameType
Caregiver notes      ──┼── boundary ─────┤── difficulty
Emergency contacts   ──┤   (explicit,    │── accuracy / completion / hintRate
Profile & prefs      ──┘    versioned)   │── durationBucket / monthBucket
                                         └── pseudonymous participant id
```

Everything on the left is ordinary product data. Nothing crosses the boundary
without an explicit, current, un-withdrawn "yes" — and even then, only the
fields on the right cross, built from an allowlist rather than filtered from a
product row. Personal memories, notes, contacts, reminders and the profile do
not cross at all, at any consent level.

See [research-data.md](research-data.md) for the export itself.

---

## 3. The consent model

`ResearchConsent` — one row per person per consent **version**.

| Field | Meaning |
|---|---|
| `version` | e.g. `research-consent-v1`. Identifies the exact words shown. |
| `purpose` | `RESEARCH_IMPROVEMENT`. Not medical research. |
| `consented` | The current answer for this version. |
| `consentedAt` | When they agreed. Null if they never did. |
| `withdrawnAt` | When they withdrew. Null otherwise. |

### Five states, not a boolean

`lib/privacy/consent.ts` resolves stored rows into one of:

| State | Meaning | Research eligible? | Ask again? |
|---|---|---|---|
| `NOT_ASKED` | No row for the current version | No | Yes |
| `GRANTED` | Agreed, current version, not withdrawn | **Yes** | No |
| `DECLINED` | Was asked, said "Not now" | No | No |
| `WITHDRAWN` | Agreed once, then withdrew | No | No |
| `SUPERSEDED` | Agreed only to older wording | No | Yes |

Collapsing these into a boolean would make it impossible to tell someone who
said no from someone who was never offered the choice. `DECLINED` is recorded
rather than treated as silence, so the question is not asked on every visit —
that would be nagging someone into a yes.

### Versioning

If the explanation changes materially, `CURRENT_CONSENT_VERSION` is bumped.
An old row does not satisfy new wording: the state becomes `SUPERSEDED`, the
person is asked again, and research eligibility is **false** in the meantime.
An old "yes" is never carried forward onto something different.

---

## 4. The consent experience

**Primary interface:** one sentence and two buttons of equal weight.

> Would you like to allow your activity data to help improve Cognisaarthi?
>
> [ Allow ]  [ Not now ]  Learn more ▾

No pre-selected answer, no default-on toggle, no dark pattern making "Allow"
easier to press than "Not now". A consent flow that nudges is not a consent
flow.

**"Learn more"** expands the longer explanation — five plain sentences, not a
legal document. It says what is used, what is never included, that it is not
linked to a name, that it is not a medical study, and that the decision can be
changed at any time.

Available in **English, Hindi and Assamese**. The copy lives in
`lib/privacy/consent.ts` beside its version identifier rather than in
`dictionaries.ts`, so the words a person agreed to and the version recorded
against them cannot drift apart.

**Accessibility:** `lg` buttons (clearing the 64px elder target at base scale),
everything sized in `rem`, every state carrying an icon and a sentence as well
as a colour, `role="status"` on the state line, `aria-expanded` on "Learn more".

---

## 5. Caregiver consent — a documented limitation

**A caregiver cannot consent on an elder's behalf. This is deliberate.**

A `CaregiverLink` records a care relationship. It does not record legal
guardianship, power of attorney, or any verified authority to make decisions
for another adult — and Cognisaarthi has no mechanism to establish one. A
daughter who helps her mother with reminders has not thereby acquired the right
to enter her mother into a research dataset.

Rather than approximate that authority, **the capability does not exist**:

- `/api/privacy/consent` reads identity from the **elder** session cookie only.
- `researchConsentSchema` has no `userId` field, so a request body cannot
  nominate whose consent is being changed.
- `grantConsent`, `declineConsent` and `withdrawConsent` take a `userId` that
  only ever comes from an authenticated elder session. No function accepts a
  caregiver id.

This is a property of the types, not a rule someone has to remember to check.
A test (`consent-persistence.test.ts`) asserts that an ACTIVE caregiver link
grants no research eligibility by itself.

**Limitation:** this means a person who genuinely cannot make the decision for
themselves simply is not included in research. That is the correct failure
direction. A proper substituted-decision mechanism would need verified legal
authority, which is out of scope and should not be faked.

---

## 6. Withdrawal

`Profile → Privacy and data → Stop allowing this`

What withdrawal does:

- Sets `withdrawnAt`; eligibility becomes false immediately.
- Activity from that moment onward falls outside the consented window and will
  not appear in any future export.
- Requires an **explicit new grant** to become eligible again. Nothing
  re-consents silently, however many times the status is read.

What withdrawal does **not** do:

- It does not delete history, memories or reminders. Withdrawing research
  consent is not a request to lose the product, and treating it as one would
  punish the choice.
- It is not retroactive erasure of what already happened inside the consented
  window. Activity from that window remains describable as having occurred
  under consent; pretending otherwise would misdescribe the past. (There is
  no separately stored research copy to expire — see §7.)

A separate deletion request (§9) is how someone removes data itself.

---

## 7. Retention policy

Defined in `lib/privacy/retention.ts`. **These periods are product choices, not
legal requirements.** Cognisaarthi is not a medical record system and is not
subject to a clinical retention statute; inventing "7 years, as required by
law" would be a fiction. A test asserts that no rationale claims otherwise.

| Category | Control | Period | Rationale |
|---|---|---|---|
| Game sessions | Policy | **730 days** | The trend layer compares months to months; two years is the shortest window still supporting a year-over-year comparison. |
| Reminder logs | Policy | **365 days** | Covers seasonal routines without an indefinite minute-by-minute diary. |
| Alerts | Policy | **180 days** | An alert nobody acted on in six months is no longer a signal. |
| Personal memories | **User** | — | The most personal data in the product and the least suitable for a clock. Stays until removed. |
| Caregiver notes | **User** | — | Written by a person about a person; a timer would lose chosen context. |
| Research representation | **Consent** | — | Derived at export time, not stored. Withdrawal ends eligibility; there is no copy to expire. |
| Audit events | Policy | **1095 days** | Longer than what it describes — a log that expires before its subject corroborates nothing. Contains no content. |

`isExpired()` returns **false** for user- and consent-controlled categories and
for any unknown category. It fails closed: data nobody wrote a rule for is not
deleted.

The module only **decides** eligibility. Nothing in it deletes anything;
applying a policy is a separate, deliberate act.

---

## 8. Audit logging

`AuditEvent` records that a sensitive thing happened:

`RESEARCH_CONSENT_GRANTED` · `RESEARCH_CONSENT_WITHDRAWN` ·
`RESEARCH_EXPORT_GENERATED` · `CAREGIVER_SNAPSHOT_ISSUED` ·
`ACCOUNT_DATA_EXPORTED` · `ACCOUNT_DATA_DELETED` · `CAREGIVER_LINK_CHANGED`

**Never recorded:** passwords, hashes, tokens, cookies, emails, phone numbers,
names, memory content, note bodies, reminder titles, or any exported row.
`sanitiseDetail()` enforces this by dropping forbidden keys (case-insensitively),
dropping all nested objects and arrays — the place content hides — and
truncating strings at 64 characters.

`AuditEvent` has **no foreign key** and is not cascaded. An audit entry that is
deleted along with the account it describes cannot answer the one question an
audit log exists to answer. A test asserts the trail survives deletion.

A failed audit write never fails the operation it describes. Refusing someone's
consent withdrawal over a logging error would be the worse failure by far.

---

## 9. Data export and deletion

### Their own copy — `lib/privacy/data-export.ts`

Complete and plainly readable: profile, preferences, consent status, activities,
reminders, memories, caregiver notes, caregiver names, emergency contacts.

Excluded even here: password hashes and session tokens (a copy of a credential
is a credential), the caregiver's email, and image **bytes** — the export names
which memories have a photo rather than inlining megabytes of family
photographs into a JSON blob that might then be emailed around.

### Deletion — `lib/privacy/data-deletion.ts`

Deliberately **not** `prisma.user.delete()`, even though the cascades appear to
do the job:

1. **Memory image files.** Photographs live on disk under
   `./storage/memory-images`, not in PostgreSQL. A cascade removes the
   `PersonalMemory` row and orphans the JPEG — leaving a family photo on disk
   with no record of who it belongs to. The service reads the filenames first
   and unlinks them after the database commits.
2. **Audit events.** Not cascaded, by design (§8).
3. **Caregiver accounts.** Untouched — a separate person with their own login.
   Their *link* goes, so their access ends.

`planAccountDeletion()` reports exactly what would be removed, and what would
not, without removing anything. Deletion is irreversible, so the plan is
separable from the act.

**Status: the service is implemented and tested. It is not yet wired to a
user-facing "delete my account" button.** Exposing an irreversible,
one-tap-from-the-profile-screen destruction of an elderly person's photographs
needs a confirmation design this phase did not do. The architecture is ready;
the button is a deliberate omission, not an oversight.

### Limitation: offline devices

Server-side deletion cannot reach a device that is offline. The local replica is
cleared on sign-out (`wipeLocalDataOnSignOut`) and when a different person signs
in on the same device (`ensureUserScope`). A device that never reconnects keeps
its copy until one of those happens.

---

## 10. Where the code is

| Path | What |
|---|---|
| `lib/privacy/consent.ts` | Consent states, versioning, eligibility windows, copy (EN/HI/AS). Pure. |
| `lib/privacy/server.ts` | Grant / decline / withdraw, against the database. Elder identity only. |
| `lib/privacy/retention.ts` | The policy table and eligibility rules. Pure; deletes nothing. |
| `lib/privacy/audit.ts` | `recordAudit`, `sanitiseDetail`. |
| `lib/privacy/pseudonymise.ts` | HMAC participant ids. Refuses without a dedicated secret. |
| `lib/privacy/data-export.ts` | A person's own copy of their data. |
| `lib/privacy/data-deletion.ts` | Planned, file-aware account deletion. |
| `app/api/privacy/consent/route.ts` | The only HTTP surface. Elder cookie only. |
| `app/profile/privacy/page.tsx` | Privacy and data, for the elder. |
| `components/elderly/ResearchConsentCard.tsx` | The consent question itself. |
