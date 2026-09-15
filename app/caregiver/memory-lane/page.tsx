import Link from "next/link";
import { ChevronLeft, Sprout } from "lucide-react";

import { CaregiverShell } from "@/components/caregiver/CaregiverShell";
import {
  MemoryRetention,
  type RetentionRow,
} from "@/components/caregiver/MemoryRetention";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/memories/queries";
import { getScheduledMemoriesForCaregiver } from "@/lib/memories/server";
import { getCaregiverDict, fill } from "@/lib/i18n/caregiver";
import { caregiverLanguage } from "@/lib/caregiver/preferences";
import { localeTag } from "@/lib/i18n/dictionaries";
import { SignOutButton } from "../SignOutButton";

/**
 * MEMORY RETENTION — the caregiver's view of Memory Lane.
 *
 * `force-dynamic` because due-ness depends on the clock: a cached
 * render would report a memory as due at whatever time the page
 * happened to be built.
 */
export const dynamic = "force-dynamic";

export default async function CaregiverMemoryLanePage() {
  const caregiver = await requireCaregiver();
  const language = await caregiverLanguage(caregiver.id);
  const dict = getCaregiverDict(language);
  const user = await linkedUserFor(caregiver.id);

  if (!user) {
    return (
      <CaregiverShell
        action={<SignOutButton label={dict.signOut} />}
        nav
        language={language}
      >
        <EmptyState
          title={dict.notConnectedTitle}
          body={dict.notConnectedMemories}
        />
      </CaregiverShell>
    );
  }

  const now = new Date();
  // Re-checks the link rather than trusting `linkedUserFor` above, so
  // authorization is enforced by the query that reads the data and not
  // only by the one that found the elder.
  const scheduled = await getScheduledMemoriesForCaregiver(
    caregiver.id,
    user.id,
    now,
  );

  const rows: RetentionRow[] = (scheduled ?? []).map((row) => ({
    id: row.memory.id,
    title: row.memory.title,
    relationship: row.memory.relationship,
    category: row.memory.category,
    // `getScheduledMemories` returns only enabled memories today; the
    // flag is carried anyway so the card can say so if that changes.
    enabled: true,
    hasAudio: row.memory.hasAudio,
    state: row.state,
    events: row.events.map((event) => ({
      id: event.id,
      outcome: event.outcome,
      intervalStep: event.intervalStep,
      occurredAt: event.occurredAt,
    })),
  }));

  const practised = rows.filter((row) => row.events.length > 0);

  return (
    <CaregiverShell
      action={<SignOutButton label={dict.signOut} />}
      nav
      subject={user.name}
      language={language}
    >
      <Link
        href="/caregiver"
        className="inline-flex min-h-[2.75rem] items-center gap-1 rounded-lg pr-3 text-base font-semibold text-text-muted hover:text-text"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {dict.backToDashboard}
      </Link>

      <h1 className="mt-3 font-serif text-3xl font-semibold">
        {fill(dict.memoryLaneTitle, { name: user.name })}
      </h1>
      <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-text-muted">
        {fill(dict.memoryLaneHelp, { name: user.name })}
      </p>

      {rows.length === 0 || practised.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={dict.memoryLaneEmpty}
            body={fill(dict.memoryLaneEmptyHelp, { name: user.name })}
            icon={<Sprout className="size-10" aria-hidden />}
          />
        </div>
      ) : (
        <MemoryRetention
          rows={rows}
          dict={dict}
          locale={localeTag(language)}
          now={now}
        />
      )}

      {/* Deliberately NOT the dashboard's `notMedicalNotice`, which
          opens "These scores…". There are no scores on this page, and
          a disclaimer that describes something the reader cannot see
          invites them to go looking for it. `memoryLaneHelp` above
          carries the stronger and more accurate version: these are
          labels for a practice schedule, not a measurement. */}
      <p className="mt-9 rounded-2xl border border-border bg-surface-alt/60 px-5 py-4 text-base leading-relaxed text-text-muted">
        {dict.memoryLaneNotMedical}
      </p>
    </CaregiverShell>
  );
}
