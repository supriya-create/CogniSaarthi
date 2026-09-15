"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import type { MemoryCategory, PersonalMemory } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Caregiver-side management of one elder's personal memories: add,
 * edit, delete, and choose whether each may be used in recall
 * activities. Photos upload through the authenticated API; nothing
 * here is ever a public URL.
 */

const CATEGORIES: { value: MemoryCategory; label: string }[] = [
  { value: "PERSON", label: "Person" },
  { value: "PLACE", label: "Place" },
  { value: "THING", label: "Thing" },
  { value: "MOMENT", label: "Moment" },
];

const CATEGORY_LABEL: Record<MemoryCategory, string> = {
  PERSON: "Person",
  PLACE: "Place",
  THING: "Thing",
  MOMENT: "Moment",
};

type Draft = {
  id: string | null;
  category: MemoryCategory;
  title: string;
  relationship: string;
  description: string;
  enabled: boolean;
};

const EMPTY: Draft = {
  id: null,
  category: "PERSON",
  title: "",
  relationship: "",
  description: "",
  enabled: true,
};

export function MemoryManager({
  memories,
  userName,
}: {
  memories: PersonalMemory[];
  userName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setError(null);
    setDraft({ ...EMPTY });
  }

  function openEdit(memory: PersonalMemory) {
    setError(null);
    setDraft({
      id: memory.id,
      category: memory.category,
      title: memory.title,
      relationship: memory.relationship ?? "",
      description: memory.description ?? "",
      enabled: memory.enabled,
    });
  }

  async function save() {
    if (!draft) return;
    if (draft.title.trim().length === 0) {
      setError("Please give this memory a name or title.");
      return;
    }
    setSaving(true);
    setError(null);

    const body = new FormData();
    body.set("category", draft.category);
    body.set("title", draft.title.trim());
    body.set("relationship", draft.relationship.trim());
    body.set("description", draft.description.trim());
    body.set("enabled", String(draft.enabled));
    const file = fileRef.current?.files?.[0];
    if (file) body.set("image", file);

    const url = draft.id
      ? `/api/caregiver/memories/${draft.id}`
      : "/api/caregiver/memories";
    const method = draft.id ? "PATCH" : "POST";

    try {
      const response = await fetch(url, { method, body });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(messageFor(data.error));
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

  async function remove(memory: PersonalMemory) {
    if (!confirm(`Delete "${memory.title}"? This cannot be undone.`)) return;
    await fetch(`/api/caregiver/memories/${memory.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Memory bank</h2>
          <p className="mt-1 text-base text-text-muted">
            People, places and moments {userName} may enjoy remembering.
          </p>
        </div>
        {!draft ? (
          <Button
            size="sm"
            onClick={openAdd}
            icon={<Plus className="size-5" aria-hidden />}
          >
            Add memory
          </Button>
        ) : null}
      </div>

      {draft ? (
        <MemoryForm
          draft={draft}
          setDraft={setDraft}
          fileRef={fileRef}
          onSave={save}
          onCancel={() => setDraft(null)}
          saving={saving}
          error={error}
        />
      ) : null}

      {memories.length === 0 && !draft ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center text-lg text-text-muted">
          No memories yet. Add a family member or a favourite place to begin.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {memories.map((memory) => (
            <li
              key={memory.id}
              className="flex gap-4 panel p-4 shadow-soft"
            >
              <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-alt">
                {memory.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/memories/${memory.id}/image`}
                    alt={memory.title}
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-8 text-text-muted" aria-hidden />
                )}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="truncate text-lg font-semibold">
                    {memory.title}
                  </span>
                  <span className="shrink-0 rounded-full border border-border bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted">
                    {CATEGORY_LABEL[memory.category]}
                  </span>
                </span>
                {memory.relationship ? (
                  <span className="text-sm text-text-muted">
                    {memory.relationship}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "mt-1 text-xs font-medium",
                    memory.enabled ? "text-success" : "text-text-muted",
                  )}
                >
                  {memory.enabled
                    ? "✓ Available for memory activities"
                    : "Hidden from activities"}
                </span>

                <div className="mt-auto flex gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(memory)}
                    icon={<Pencil className="size-4" aria-hidden />}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => remove(memory)}
                    icon={<Trash2 className="size-4" aria-hidden />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function messageFor(error: string | undefined): string {
  switch (error) {
    case "image_type":
      return "That image type is not supported. Use a JP, PNG or WebP photo.";
    case "image_size":
      return "That photo is too large. Please use one under 5 MB.";
    case "no_linked_user":
      return "No connected family member was found for your account.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function MemoryForm({
  draft,
  setDraft,
  fileRef,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="mt-6 panel p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">
          {draft.id ? "Edit memory" : "Add a memory"}
        </h3>
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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Category</span>
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as MemoryCategory })
            }
            className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {draft.category === "PERSON" ? "Name" : "Title"}
          </span>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            maxLength={60}
            className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
          />
        </label>

        {draft.category === "PERSON" ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Relationship</span>
            <input
              value={draft.relationship}
              onChange={(e) =>
                setDraft({ ...draft, relationship: e.target.value })
              }
              maxLength={40}
              placeholder="e.g. Daughter"
              className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Short note (optional)</span>
          <textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            maxLength={300}
            rows={2}
            className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">Photo (optional)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
          />
          <span className="text-xs text-text-muted">
            JPG, PNG or WebP, up to 5 MB. Stored privately.
          </span>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          className="size-5"
        />
        <span className="text-base font-medium">
          Available for memory activities
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-base font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save memory"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
