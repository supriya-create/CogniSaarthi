"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import type {
  ReminderCategory,
  ReminderPriority,
  RecurrenceType,
} from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { REMINDER_CATEGORY_EMOJI } from "@/lib/reminders/labels";
import { cn } from "@/lib/utils/cn";

/**
 * Caregiver-side reminder management: create, edit, enable/disable and
 * delete reminders for the connected elder. Informative and dense —
 * this is the caregiver side — while the copy stays neutral (a
 * MEDICATION reminder is a label, never a medical instruction).
 */

export interface ReminderDTO {
  id: string;
  title: string;
  description: string;
  category: ReminderCategory;
  priority: ReminderPriority;
  time: string; // HH:MM
  recurrence: RecurrenceType;
  weekdays: number[];
  monthDay: number | null;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  enabled: boolean;
  scheduleSummary: string;
}

const CATEGORIES: { value: ReminderCategory; label: string }[] = [
  { value: "MEDICATION", label: "💊 Medication" },
  { value: "APPOINTMENT", label: "🏥 Appointment" },
  { value: "DAILY_ROUTINE", label: "🌼 Daily routine" },
  { value: "COGNITIVE_ACTIVITY", label: "🧠 Cognitive activity" },
  { value: "FAMILY", label: "👪 Family" },
  { value: "OTHER", label: "🔔 Other" },
];

const RECURRENCES: { value: RecurrenceType; label: string }[] = [
  { value: "ONCE", label: "Once" },
  { value: "DAILY", label: "Every day" },
  { value: "WEEKLY", label: "Chosen weekdays" },
  { value: "MONTHLY", label: "Monthly" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Draft = Omit<ReminderDTO, "scheduleSummary">;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(): Draft {
  return {
    id: "",
    title: "",
    description: "",
    category: "MEDICATION",
    priority: "NORMAL",
    time: "08:00",
    recurrence: "DAILY",
    weekdays: [1, 2, 3, 4, 5],
    monthDay: 1,
    startDate: todayISO(),
    endDate: null,
    enabled: true,
  };
}

export function ReminderManager({
  reminders,
  userName,
}: {
  reminders: ReminderDTO[];
  userName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd() {
    setError(null);
    setDraft(emptyDraft());
  }

  function openEdit(r: ReminderDTO) {
    setError(null);
    setDraft({ ...r });
  }

  async function save() {
    if (!draft) return;
    if (draft.title.trim().length === 0) {
      setError("Please give this reminder a title.");
      return;
    }
    setSaving(true);
    setError(null);

    const body = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
      priority: draft.priority,
      time: draft.time,
      recurrence: draft.recurrence,
      weekdays: draft.recurrence === "WEEKLY" ? draft.weekdays : [],
      monthDay: draft.recurrence === "MONTHLY" ? draft.monthDay : null,
      startDate: draft.startDate,
      endDate: draft.endDate || null,
      enabled: draft.enabled,
    };

    const url = draft.id
      ? `/api/caregiver/reminders/${draft.id}`
      : "/api/caregiver/reminders";
    const method = draft.id ? "PATCH" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError("Please check the reminder details and try again.");
        setSaving(false);
        return;
      }
      setDraft(null);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  async function toggle(r: ReminderDTO) {
    await fetch(`/api/caregiver/reminders/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    router.refresh();
  }

  async function remove(r: ReminderDTO) {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    await fetch(`/api/caregiver/reminders/${r.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {userName}&apos;s reminders
          </h1>
          <p className="mt-1 text-base text-text-muted">
            Times are set in {userName}&apos;s own timezone.
          </p>
        </div>
        {!draft ? (
          <Button
            size="sm"
            onClick={openAdd}
            icon={<Plus className="size-5" aria-hidden />}
          >
            Add reminder
          </Button>
        ) : null}
      </div>

      {draft ? (
        <ReminderForm
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          onCancel={() => setDraft(null)}
          saving={saving}
          error={error}
        />
      ) : null}

      {reminders.length === 0 && !draft ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center text-text-muted">
          No reminders yet. Add a medication time, an appointment or a daily
          routine.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {reminders.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border bg-surface p-4 shadow-soft",
                r.enabled ? "border-border" : "border-border opacity-60",
              )}
            >
              <span className="text-3xl" aria-hidden>
                {REMINDER_CATEGORY_EMOJI[r.category]}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{r.title}</span>
                  {r.priority === "IMPORTANT" ? (
                    <span className="rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                      Important
                    </span>
                  ) : null}
                  {!r.enabled ? (
                    <span className="rounded-full border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted">
                      Off
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-text-muted">
                  {r.scheduleSummary}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggle(r)}
                  icon={<Power className="size-4" aria-hidden />}
                >
                  {r.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(r)}
                  icon={<Pencil className="size-4" aria-hidden />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => remove(r)}
                  icon={<Trash2 className="size-4" aria-hidden />}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const FIELD =
  "rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5";

function ReminderForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-semibold">
          {draft.id ? "Edit reminder" : "Add a reminder"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Title</span>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            maxLength={80}
            placeholder="e.g. Morning medication"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Category</span>
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as ReminderCategory })
            }
            className={FIELD}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Time</span>
          <input
            type="time"
            value={draft.time}
            onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Repeats</span>
          <select
            value={draft.recurrence}
            onChange={(e) =>
              setDraft({ ...draft, recurrence: e.target.value as RecurrenceType })
            }
            className={FIELD}
          >
            {RECURRENCES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Priority</span>
          <select
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as ReminderPriority })
            }
            className={FIELD}
          >
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Important</option>
          </select>
        </label>

        {draft.recurrence === "WEEKLY" ? (
          <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
            <legend className="text-sm font-semibold">On these days</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS.map((label, index) => {
                const on = draft.weekdays.includes(index);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        weekdays: on
                          ? draft.weekdays.filter((d) => d !== index)
                          : [...draft.weekdays, index],
                      })
                    }
                    className={cn(
                      "min-h-[2.75rem] min-w-[3rem] rounded-xl border-2 px-3 py-2 text-sm font-semibold",
                      on
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border-strong bg-surface text-text-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {draft.recurrence === "MONTHLY" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Day of month</span>
            <input
              type="number"
              min={1}
              max={31}
              value={draft.monthDay ?? 1}
              onChange={(e) =>
                setDraft({ ...draft, monthDay: Number(e.target.value) })
              }
              className={FIELD}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {draft.recurrence === "ONCE" ? "Date" : "Starts on"}
          </span>
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            className={FIELD}
          />
        </label>

        {draft.recurrence !== "ONCE" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Ends on (optional)</span>
            <input
              type="date"
              value={draft.endDate ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, endDate: e.target.value || null })
              }
              className={FIELD}
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Note (optional)</span>
          <input
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            maxLength={300}
            className={FIELD}
          />
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          className="size-5"
        />
        <span className="text-base font-medium">Reminder is on</span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-base font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save reminder"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
