"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleQuestionMark,
} from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { consentCopy } from "@/lib/privacy/consent";
import type { ConsentState, ConsentStatus } from "@/lib/privacy/consent";
import { getDict } from "@/lib/i18n/dictionaries";

/**
 * The consent question, as an elderly person actually meets it.
 *
 * Three things this deliberately does NOT do:
 *
 *  1. It does not put a legal document in front of the person. The
 *     primary interface is one sentence and two buttons. The longer
 *     explanation is real, and reachable, and second.
 *  2. It does not pre-select an answer. There is no default-on toggle;
 *     "Allow" and "Not now" carry equal visual weight, because a
 *     consent flow that nudges is not a consent flow.
 *  3. It does not use colour alone for state. Every status carries an
 *     icon and a sentence, per the project's accessibility rule.
 *
 * Buttons are the `lg` size, which clears the 64px elder touch target
 * at the base text scale, and everything sizes in `rem` so the text
 * preference scales it.
 */

const STATE_ICON: Record<ConsentState, typeof CircleCheck> = {
  GRANTED: CircleCheck,
  DECLINED: CircleMinus,
  WITHDRAWN: CircleMinus,
  NOT_ASKED: CircleDashed,
  SUPERSEDED: CircleQuestionMark,
};

const STATE_TONE: Record<ConsentState, string> = {
  GRANTED: "text-success",
  DECLINED: "text-text-muted",
  WITHDRAWN: "text-text-muted",
  NOT_ASKED: "text-text-muted",
  SUPERSEDED: "text-warning",
};

export function ResearchConsentCard({
  language,
  initial,
  /** Pre-formatted on the server, so the two renders agree. */
  lastUpdatedLabel,
}: {
  language: Language;
  initial: ConsentStatus;
  lastUpdatedLabel: string | null;
}) {
  const router = useRouter();
  const dict = getDict(language);
  const copy = consentCopy(language);

  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  async function answer(action: "GRANT" | "DECLINE" | "WITHDRAW") {
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch("/api/privacy/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setStatus((await response.json()) as ConsentStatus);
      // The server-rendered "last changed" line is now out of date.
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const statusText = {
    GRANTED: dict.privacyStatusGranted,
    DECLINED: dict.privacyStatusDeclined,
    WITHDRAWN: dict.privacyStatusWithdrawn,
    NOT_ASKED: dict.privacyStatusNotAsked,
    SUPERSEDED: dict.privacyStatusSuperseded,
  }[status.state];

  const StateIcon = STATE_ICON[status.state];

  return (
    <section className="panel p-6 shadow-soft">
      <h2 className="font-serif text-2xl leading-tight font-semibold">
        {dict.privacyResearchHeading}
      </h2>

      <p className="mt-3 text-xl leading-relaxed">{copy.summary}</p>

      {/* State: icon + words, never colour on its own. */}
      <p
        className={`mt-5 flex items-start gap-2.5 text-lg font-medium ${STATE_TONE[status.state]}`}
        role="status"
        aria-live="polite"
      >
        <StateIcon className="mt-0.5 size-6 shrink-0" aria-hidden />
        <span>
          <span className="sr-only">{dict.privacyStatusLabel}: </span>
          {statusText}
        </span>
      </p>

      {lastUpdatedLabel && status.state !== "NOT_ASKED" ? (
        <p className="mt-1.5 text-base text-text-muted">
          {dict.privacyLastUpdated}: {lastUpdatedLabel}
        </p>
      ) : null}

      {/* Actions. Equal weight — neither answer is the "right" one. */}
      <div className="mt-6 flex flex-wrap gap-3">
        {status.researchEligible ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void answer("WITHDRAW")}
          >
            {dict.privacyWithdraw}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void answer("GRANT")}
            >
              {status.state === "NOT_ASKED" || status.state === "SUPERSEDED"
                ? copy.allow
                : dict.privacyAllowAgain}
            </Button>
            {status.needsDecision ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void answer("DECLINE")}
              >
                {copy.decline}
              </Button>
            ) : null}
          </>
        )}
      </div>

      {busy ? (
        <p className="mt-3 text-base text-text-muted" role="status">
          {dict.privacySaving}
        </p>
      ) : null}
      {failed ? (
        <p className="mt-3 text-base font-medium text-error" role="alert">
          {dict.privacySaveError}
        </p>
      ) : null}

      <p className="mt-4 text-base leading-relaxed text-text-muted">
        {dict.privacyChangeAnyTime} {dict.privacyNothingElseChanges}
      </p>

      {/* "Learn more" — the detail is available, and it is second. */}
      <button
        type="button"
        onClick={() => setShowDetails((open) => !open)}
        aria-expanded={showDetails}
        className="mt-5 inline-flex min-h-[3rem] cursor-pointer items-center gap-2 rounded-xl px-2 text-lg font-semibold text-primary hover:underline"
      >
        {copy.learnMore}
        <ChevronDown
          className={`size-5 transition-transform ${showDetails ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {showDetails ? (
        <ul className="mt-2 flex flex-col gap-3 rounded-xl border border-border bg-surface-alt p-5">
          {copy.details.map((line) => (
            <li key={line} className="text-lg leading-relaxed">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
