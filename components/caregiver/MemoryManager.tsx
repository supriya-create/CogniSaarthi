"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageIcon, Pencil, Plus, Trash2, X } from "lucide-react";
import type { MemoryCategory, Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { VoiceRecorder } from "@/components/caregiver/VoiceRecorder";
import {
  getCaregiverDict,
  fill,
  type CaregiverDict,
} from "@/lib/i18n/caregiver";
import { cn } from "@/lib/utils/cn";

/**
 * Caregiver-side management of one elder's personal memories: add,
 * edit, delete, choose whether each may be used in recall activities,
 * and record a familiar voice for it.
 *
 * Photos and recordings both upload through authenticated API routes;
 * nothing here is ever a public URL.
 *
 * Phase 8 translated this screen. It had been the last caregiver
 * surface with English written straight into the markup, which on a
 * dashboard a daughter in Jorhat reads in Assamese is not a small gap
 * — the page around it was translated, so the untranslated words read
 * as a bug rather than as a limitation.
 */

const CATEGORIES: MemoryCategory[] = ["PERSON", "PLACE", "THING", "MOMENT"];

function categoryLabel(dict: CaregiverDict, category: MemoryCategory): string {
  return dict[`memoryCat${category}` as const];
}

/**
 * What this component needs about a memory. A local shape rather than
 * Prisma's `PersonalMemory`, because it also needs to know whether a
 * recording exists — and because a client component has no business
 * receiving a database row wholesale.
 */
export interface ManagedMemory {
  id: string;
  category: MemoryCategory;
  title: string;
  relationship: string | null;
  description: string | null;
  enabled: boolean;
  hasImage: boolean;
  hasAudio: boolean;
}

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
  language,
}: {
  memories: ManagedMemory[];
  userName: string;
  language: Language;
}) {
  const dict = getCaregiverDict(language);
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setError(null);
    setDraft({ ...EMPTY });
  }

  function openEdit(memory: ManagedMemory) {
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
      setError(dict.memoryNeedsTitle);
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
        setError(messageFor(dict, data.error));
        setSaving(false);
        return;
      }
      setDraft(null);
      setSaving(false);
      router.refresh();
    } catch {
      setError(dict.somethingWentWrong);
      setSaving(false);
    }
  }

  async function remove(memory: ManagedMemory) {
    if (!confirm(fill(dict.memoryDeleteConfirm, { title: memory.title }))) {
      return;
    }
    await fetch(`/api/caregiver/memories/${memory.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section className="mt-9">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            {dict.memoryBank}
          </h2>
          <p className="mt-1 text-base text-text-muted">
            {fill(dict.memoryBankSubtitle, { name: userName })}
          </p>
        </div>
        {!draft ? (
          <Button
            size="sm"
            onClick={openAdd}
            icon={<Plus className="size-5" aria-hidden />}
          >
            {dict.addMemory}
          </Button>
        ) : null}
      </div>

      {draft ? (
        <MemoryForm
          dict={dict}
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
          {dict.memoryNoneYet}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {memories.map((memory) => (
            <li key={memory.id} className="panel flex flex-col p-4 shadow-soft">
              <div className="flex gap-4">
                <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-alt">
                  {memory.hasImage ? (
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
                      {categoryLabel(dict, memory.category)}
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
                      ? `✓ ${dict.memoryAvailable}`
                      : dict.memoryHidden}
                  </span>

                  <div className="mt-auto flex gap-2 pt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(memory)}
                      icon={<Pencil className="size-4" aria-hidden />}
                    >
                      {dict.edit}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void remove(memory)}
                      icon={<Trash2 className="size-4" aria-hidden />}
                    >
                      {dict.remove}
                    </Button>
                  </div>
                </div>
              </div>

              {/* The familiar voice Memory Lane plays when the answer
                  does not come. Under the memory it belongs to, not on
                  a screen of its own — it is a property of this
                  photograph, and a caregiver looking at the photograph
                  is the person who knows what to say about it. */}
              <VoiceRecorder
                memoryId={memory.id}
                hasAudio={memory.hasAudio}
                language={language}
                onChanged={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function messageFor(dict: CaregiverDict, error: string | undefined): string {
  switch (error) {
    case "image_type":
      return dict.errorImageType;
    case "image_size":
      return dict.errorImageSize;
    case "no_linked_user":
      return dict.errorNoLinkedUser;
    default:
      return dict.somethingWentWrong;
  }
}

function MemoryForm({
  dict,
  draft,
  setDraft,
  fileRef,
  onSave,
  onCancel,
  saving,
  error,
}: {
  dict: CaregiverDict;
  draft: Draft;
  setDraft: (d: Draft) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="panel mt-6 p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold">
          {draft.id ? dict.memoryEditTitle : dict.addMemory}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label={dict.cancel}
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{dict.memoryCategory}</span>
          <select
            value={draft.category}
            onChange={(e) =>
              setDraft({ ...draft, category: e.target.value as MemoryCategory })
            }
            className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {categoryLabel(dict, value)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">
            {draft.category === "PERSON"
              ? dict.memoryNameField
              : dict.memoryTitleField}
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
            <span className="text-sm font-semibold">
              {dict.memoryRelationship}
            </span>
            <input
              value={draft.relationship}
              onChange={(e) =>
                setDraft({ ...draft, relationship: e.target.value })
              }
              maxLength={40}
              placeholder={dict.memoryRelationshipPlaceholder}
              className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-sm font-semibold">
            {dict.memoryNoteOptional}
          </span>
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
          <span className="text-sm font-semibold">
            {dict.memoryPhotoOptional}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm"
          />
          <span className="text-xs text-text-muted">{dict.memoryPhotoHelp}</span>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          className="size-5"
        />
        <span className="text-base font-medium">{dict.memoryAvailable}</span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 text-base font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? dict.saving : dict.memorySave}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {dict.cancel}
        </Button>
      </div>
    </div>
  );
}
