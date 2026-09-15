"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import type { Language } from "@prisma/client";

import { LANGUAGES } from "@/lib/i18n/dictionaries";
import {
  getCaregiverDict,
  fill,
  type CaregiverDict,
} from "@/lib/i18n/caregiver";
import { cn } from "@/lib/utils/cn";

/**
 * The caregiver's own settings: their dashboard language, what they
 * want shown, and the timezone the elder's reminders are scheduled in.
 *
 * The language control here is the caregiver's ALONE. It PATCHes
 * /api/caregiver/preferences, whose schema has no field naming another
 * person, and writes to `CaregiverPreference` — so it cannot reach the
 * elder's `UserPreference` and change the interface of the person who
 * depends on it. That separation is tested, not just intended.
 *
 * The timezone below IS the elder's, and is a different endpoint on
 * purpose: it is a fact about where they live that a caregiver is
 * expected to correct, not a preference about how anything reads.
 */

export interface CaregiverPrefsDTO {
  language: Language;
  reminderNotifications: boolean;
  cognitiveActivityReminders: boolean;
  alertNotifications: boolean;
  weeklySummary: boolean;
}

type ToggleKey = Exclude<keyof CaregiverPrefsDTO, "language">;

const TOGGLES: {
  key: ToggleKey;
  labelKey: keyof CaregiverDict;
  helpKey: keyof CaregiverDict;
}[] = [
  {
    key: "reminderNotifications",
    labelKey: "prefReminderNotifications",
    helpKey: "prefReminderHelp",
  },
  {
    key: "cognitiveActivityReminders",
    labelKey: "prefCognitiveActivityReminders",
    helpKey: "prefActivityHelp",
  },
  {
    key: "alertNotifications",
    labelKey: "prefAlertNotifications",
    helpKey: "prefAlertsHelp",
  },
  {
    key: "weeklySummary",
    labelKey: "prefWeeklySummary",
    helpKey: "prefWeeklyHelp",
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
  const dict = getCaregiverDict(state.language);

  async function updateLanguage(next: Language) {
    setState((s) => ({ ...s, language: next }));
    await fetch("/api/caregiver/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // Only `language`. There is no field here, and none in the
      // schema, that could name the elder instead.
      body: JSON.stringify({ language: next }),
    });
    setSaved("language");
    setTimeout(() => setSaved(null), 1800);
    router.refresh();
  }

  async function updatePref(key: ToggleKey, value: boolean) {
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
        <h2 className="font-serif text-2xl font-semibold">
          {dict.settingsLanguage}
        </h2>
        <p className="mt-1 max-w-2xl text-base text-text-muted">
          {fill(dict.languageChangesOnlyYours, { name: userName })}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LANGUAGES.map(({ code, nativeLabel }) => (
            <button
              key={code}
              type="button"
              lang={code.toLowerCase()}
              aria-pressed={state.language === code}
              onClick={() => updateLanguage(code)}
              className={cn(
                "inline-flex min-h-[2.75rem] items-center gap-2 rounded-full border-2 px-5 py-2 text-base font-semibold",
                "transition-[background-color,border-color,color] duration-200 ease-gentle",
                state.language === code
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border-strong bg-surface text-text-muted hover:bg-surface-alt hover:text-text",
              )}
            >
              {/* A tick as well as the fill, so the current choice is
                  not carried by colour alone. */}
              {state.language === code ? (
                <Check className="size-4 shrink-0" aria-hidden />
              ) : null}
              {nativeLabel}
            </button>
          ))}
        </div>
        {saved === "language" ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
            <Check className="size-4" aria-hidden /> {dict.saved}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">
          {dict.settingsNotifications}
        </h2>
        <p className="mt-1 max-w-2xl text-base text-text-muted">
          {dict.settingsNotificationsInApp}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center justify-between gap-4 panel px-5 py-3.5"
            >
              <span className="flex flex-col">
                <span className="text-base font-semibold">
                  {dict[t.labelKey]}
                </span>
                <span className="text-sm text-text-muted">
                  {dict[t.helpKey]}
                </span>
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
            <Check className="size-4" aria-hidden /> {dict.saved}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">
          {fill(dict.settingsTimeZoneTitle, { name: userName })}
        </h2>
        <p className="mt-1 max-w-2xl text-base text-text-muted">
          {fill(dict.settingsTimeZoneBody, { name: userName })}
        </p>
        <label className="mt-4 flex max-w-sm flex-col gap-1.5">
          <span className="text-sm font-semibold">{dict.settingsTimeZone}</span>
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
            <Check className="size-4" aria-hidden /> {dict.saved}
          </p>
        ) : null}
      </section>
    </div>
  );
}
