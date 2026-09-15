"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CircleAlert,
  CloudOff,
  Minus,
  TrendingDown,
  TrendingUp,
  HelpCircle,
} from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { SummaryTile } from "@/components/caregiver/SummaryTile";
import * as caregiverStore from "@/lib/offline/caregiver-store";
import { reminderCategoryLabelEnglish } from "@/lib/reminders/labels";
import {
  describeAge,
  stalenessMessage,
  type CaregiverSnapshot,
  type SnapshotFreshness,
  type SnapshotTrendRow,
} from "@/lib/caregiver/snapshot-types";
import * as db from "@/lib/offline/db";
import { META_KEYS } from "@/lib/offline/schema";

/**
 * The caregiver's saved view, read from this device.
 *
 * Everything here is READ-ONLY. There is no button that changes
 * anything, because nothing a caregiver could do offline has been
 * designed to synchronise safely yet — see lib/offline/caregiver-store.ts.
 *
 * The staleness wording is never optional and never subtle. §23 of the
 * Phase 7 notes is explicit that stale information must not be
 * presented as real-time, so the age of the snapshot is the first thing
 * on the page, in words and with an icon, above any figure it explains.
 */

const TREND_ICON: Record<SnapshotTrendRow["direction"], typeof TrendingUp> = {
  IMPROVING: TrendingUp,
  DECLINING: TrendingDown,
  STEADY: Minus,
  UNKNOWN: HelpCircle,
};

/** Words as well as an icon — never direction by shape alone. */
const TREND_WORD: Record<SnapshotTrendRow["direction"], string> = {
  IMPROVING: "Improving",
  DECLINING: "Going down",
  STEADY: "Steady",
  UNKNOWN: "Not enough activity yet",
};

type Loaded =
  | { state: "LOADING" }
  | { state: "NONE" }
  | {
      state: "READY";
      snapshot: CaregiverSnapshot;
      freshness: SnapshotFreshness;
      message: string;
    };

function timeLabel(timeMinutes: number): string {
  const hours = Math.floor(timeMinutes / 60);
  const minutes = timeMinutes % 60;
  const suffix = hours < 12 ? "am" : "pm";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function CaregiverOfflineView() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "LOADING" });

  useEffect(() => {
    let cancelled = false;

    async function read() {
      // Who is this device's caregiver? Recorded when a snapshot was
      // last saved, so this works with no network and no cookie read.
      const caregiverId = await db.getMeta<string>(META_KEYS.caregiverId);
      if (cancelled) return;

      if (!caregiverId) {
        setLoaded({ state: "NONE" });
        return;
      }

      const result = await caregiverStore.readSnapshotWithFreshness(caregiverId);
      if (cancelled) return;

      if (!result || result.freshness === "INCOMPATIBLE") {
        setLoaded({ state: "NONE" });
        return;
      }

      setLoaded({
        state: "READY",
        snapshot: result.snapshot,
        freshness: result.freshness,
        message: stalenessMessage(
          result.freshness,
          result.snapshot.generatedAt,
        ),
      });
    }

    void read();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loaded.state === "LOADING") {
    return (
      <p className="text-lg text-text-muted" role="status">
        Looking for saved information…
      </p>
    );
  }

  if (loaded.state === "NONE") {
    return (
      <EmptyState
        title="No saved information on this device."
        body="Open the dashboard while you are connected, and a copy will be kept here so you can look at it later without a connection."
      />
    );
  }

  const { snapshot, freshness, message } = loaded;
  const { data } = snapshot;
  const expired = freshness === "EXPIRED";

  return (
    <>
      {/* The age of this information, first, in words. */}
      <p
        role="status"
        aria-live="polite"
        className={`flex items-start gap-2.5 rounded-2xl border px-5 py-4 text-base font-medium ${
          expired
            ? "border-warning/40 bg-warning-soft text-warning"
            : "border-border bg-surface-alt text-text-muted"
        }`}
      >
        <CloudOff className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>{message}</span>
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{data.elder.name}</h1>
          <p className="mt-1 text-lg text-text-muted">
            {data.elder.relationship} — saved{" "}
            {describeAge(snapshot.generatedAt)}
          </p>
        </div>
        <p className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-semibold text-text-muted">
          Read only
        </p>
      </div>

      <h2 className="mt-7 font-serif text-xl font-semibold">
        How the day looked
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <SummaryTile
          label="Activities"
          value={`${data.today.activitiesCompleted} / ${data.today.activitiesGoal}`}
          hint="Completed, when this was saved"
          Icon={Bell}
        />
        <SummaryTile
          label="Reminders"
          value={
            data.today.remindersTotal === 0
              ? "None due"
              : `${data.today.remindersAcknowledged} / ${data.today.remindersTotal}`
          }
          hint="Acknowledged, when this was saved"
          Icon={Bell}
        />
        <SummaryTile
          label="Average score"
          value={
            data.today.averageScore === null ? "—" : `${data.today.averageScore}%`
          }
          hint="Last 10 activities"
          Icon={Bell}
        />
      </div>

      {data.alerts.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">
            What needed attention
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.alerts.map((alert) => (
              <li
                key={`${alert.createdAt}-${alert.title}`}
                className="flex items-start gap-3 panel px-5 py-4"
              >
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
                <div>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-sm text-text-muted">{alert.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.reminders.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Reminder status</h2>
          {/* Category and time only. The reminder's own title is not
              stored on this device — see snapshot-types.ts. */}
          <ul className="mt-3 flex flex-col gap-2">
            {data.reminders.map((reminder, index) => (
              <li
                key={`${reminder.timeMinutes}-${index}`}
                className="flex items-center justify-between gap-4 panel px-5 py-3.5"
              >
                <span className="font-medium">
                  {reminderCategoryLabelEnglish(reminder.category)}
                </span>
                <span className="text-text-muted">
                  {timeLabel(reminder.timeMinutes)} — {reminder.status.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.trends.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Recent pattern</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.trends.map((trend) => {
              const Icon = TREND_ICON[trend.direction];
              return (
                <li
                  key={trend.domain}
                  className="flex items-center gap-3 panel px-5 py-3.5"
                >
                  <Icon className="size-5 shrink-0 text-text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 font-medium">{trend.label}</span>
                  <span className="text-sm text-text-muted">
                    {TREND_WORD[trend.direction]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {data.recentSessions.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-serif text-xl font-semibold">Recent activities</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {data.recentSessions.map((session, index) => (
              <li
                key={`${session.gameId}-${index}`}
                className="flex items-center justify-between gap-4 panel px-5 py-3.5"
              >
                <span className="min-w-0 flex-1 font-medium">
                  {session.gameName}
                </span>
                <span className="text-text-muted">
                  {session.score === null ? "—" : `${session.score}%`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 max-w-2xl text-base leading-relaxed text-text-muted">
        This is a copy kept on this device so you can look at it without a
        connection. It does not update on its own, and nothing on this page can
        be changed. These scores describe how the activities went, nothing
        more — they are not a medical measurement.
      </p>
    </>
  );
}
