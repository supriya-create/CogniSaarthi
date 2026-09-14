"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import type { NoteCategory } from "@prisma/client";

import { Button } from "@/components/ui/Button";

/**
 * Caregiver notes: plain observations, kept as written. Nothing here is
 * interpreted as a medical conclusion. Only the author can edit or
 * delete their own note.
 */

export interface NoteDTO {
  id: string;
  body: string;
  category: NoteCategory;
  when: string;
  mine: boolean;
  author: string;
}

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "MOOD", label: "Mood" },
  { value: "ACTIVITY", label: "Activity" },
  { value: "SLEEP", label: "Sleep" },
  { value: "APPETITE", label: "Appetite" },
  { value: "OTHER", label: "Other" },
];

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  GENERAL: "General",
  MOOD: "Mood",
  ACTIVITY: "Activity",
  SLEEP: "Sleep",
  APPETITE: "Appetite",
  OTHER: "Other",
};

type Draft = { id: string | null; body: string; category: NoteCategory };

export function NotesManager({
  notes,
  userName,
}: {
  notes: NoteDTO[];
  userName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    if (draft.body.trim().length === 0) {
      setError("Please write a short note.");
      return;
    }
    setSaving(true);
    setError(null);
    const url = draft.id
      ? `/api/caregiver/notes/${draft.id}`
      : "/api/caregiver/notes";
    const method = draft.id ? "PATCH" : "POST";
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: draft.body.trim(),
          category: draft.category,
        }),
      });
      if (!response.ok) {
        setError("Something went wrong. Please try again.");
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

  async function remove(note: NoteDTO) {
    if (!confirm("Delete this note?")) return;
    await fetch(`/api/caregiver/notes/${note.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            Notes about {userName}
          </h1>
          <p className="mt-1 text-base text-text-muted">
            Your own observations, kept exactly as you write them.
          </p>
        </div>
        {!draft ? (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setDraft({ id: null, body: "", category: "GENERAL" });
            }}
            icon={<Plus className="size-5" aria-hidden />}
          >
            Add note
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold">
              {draft.id ? "Edit note" : "Add a note"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel"
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Category</span>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({ ...draft, category: e.target.value as NoteCategory })
              }
              className="max-w-xs rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Note</span>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              maxLength={500}
              rows={3}
              placeholder="e.g. Enjoyed the story activity this morning."
              className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
            />
          </label>
          {error ? (
            <p role="alert" className="mt-3 text-base font-medium text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-3">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save note"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {notes.length === 0 && !draft ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center text-text-muted">
          No notes yet. Jot down anything you would like to remember.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted">
                    {CATEGORY_LABEL[note.category]}
                  </span>
                  <span className="text-sm text-text-muted">{note.when}</span>
                  <span className="text-sm text-text-muted">· {note.author}</span>
                </div>
                {note.mine ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Edit note"
                      onClick={() =>
                        setDraft({
                          id: note.id,
                          body: note.body,
                          category: note.category,
                        })
                      }
                      className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete note"
                      onClick={() => remove(note)}
                      className="rounded-lg p-1.5 text-error hover:bg-error-soft"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-base whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
