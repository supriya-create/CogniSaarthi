"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Caregiver notification preferences and the elder's reminder timezone.
 * In-app is the only delivery channel in Phase 4, so these toggles gate
 * what the caregiver is shown — they never promise push, email or SMS.
 */

export interface CaregiverPrefsDTO {
  reminderNotifications: boolean;
  cognitiveActivityReminders: boolean;
  alertNotifications: boolean;
  weeklySummary: boolean;
}

const TOGGLES: { key: keyof CaregiverPrefsDTO; label: string; help: string }[] = [
  {
    key: "reminderNotifications",
    label: "Reminder notifications",
    help: "Show reminder activity for your family member.",
  },
  {
    key: "cognitiveActivityReminders",
    label: "Cognitive activity reminders",
    help: "Include gentle nudges towards the daily activity.",
  },
  {
    key: "alertNotifications",
    label: "Alerts",
    help: "Show meaningful updates in the alert center.",
  },
  {
    key: "weeklySummary",
    label: "Weekly summary",
    help: "Keep the Cognisaarthi weekly summary switched on.",
  },
];

const COMMON_ZONES = [
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Kathmandu",
  "Asia/Dubai",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

export function CaregiverSettings({
  prefs,
  timeZone,
  userName,
}: {
  prefs: CaregiverPrefsDTO;
  timeZone: string;
  userName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(prefs);
  const [zone, setZone] = useState(timeZone);
  const [saved, setSaved] = useState<string | null>(null);

  async function updatePref(key: keyof CaregiverPrefsDTO, value: boolean) {
    setState((s) => ({ ...s, [key]: value }));
    await fetch("/api/caregiver/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    setSaved("prefs");
    setTimeout(() => setSaved(null), 1800);
    router.refresh();
  }

  async function saveZone(next: string) {
    setZone(next);
    await fetch("/api/caregiver/elder-timezone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeZone: next }),
    });
    setSaved("zone");
    setTimeout(() => setSaved(null), 1800);
    router.refresh();
  }

  const zoneOptions = COMMON_ZONES.includes(zone)
    ? COMMON_ZONES
    : [zone, ...COMMON_ZONES];

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Notifications</h2>
        <p className="mt-1 text-base text-text-muted">
          These control what you see in Cognisaarthi. All updates are in-app —
          Cognisaarthi does not send push, email or SMS in this version.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-3.5"
            >
              <span className="flex flex-col">
                <span className="text-base font-semibold">{t.label}</span>
                <span className="text-sm text-text-muted">{t.help}</span>
              </span>
              <input
                type="checkbox"
                checked={state[t.key]}
                onChange={(e) => updatePref(t.key, e.target.checked)}
                className="size-5 shrink-0"
              />
            </label>
          ))}
        </div>
        {saved === "prefs" ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden /> Saved
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">
          {userName}&apos;s timezone
        </h2>
        <p className="mt-1 text-base text-text-muted">
          Reminders are scheduled in this timezone, so an 08:00 reminder stays
          at 08:00 where {userName} is.
        </p>
        <label className="mt-4 flex max-w-sm flex-col gap-1.5">
          <span className="text-sm font-semibold">Timezone</span>
          <select
            value={zone}
            onChange={(e) => saveZone(e.target.value)}
            className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
          >
            {zoneOptions.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        {saved === "zone" ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden /> Saved
          </p>
        ) : null}
      </section>
    </div>
  );
}
