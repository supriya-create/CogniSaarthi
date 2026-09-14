"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/Button";

/**
 * Caregiver management of the elder's emergency contacts. This creates
 * a contact card the elder can dial with one tap — nothing more.
 * Cognisaarthi never claims to contact anyone or dispatch help.
 */

export interface EmergencyContactDTO {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

type Draft = { id: string | null; name: string; phone: string; relationship: string };

export function EmergencyManager({
  contacts,
  userName,
}: {
  contacts: EmergencyContactDTO[];
  userName: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.phone.trim()) {
      setError("A name and a phone number are needed.");
      return;
    }
    setSaving(true);
    setError(null);
    const url = draft.id
      ? `/api/caregiver/emergency/${draft.id}`
      : "/api/caregiver/emergency";
    const method = draft.id ? "PATCH" : "POST";
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          relationship: draft.relationship.trim(),
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

  async function remove(c: EmergencyContactDTO) {
    if (!confirm(`Remove ${c.name} as an emergency contact?`)) return;
    await fetch(`/api/caregiver/emergency/${c.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">
            Emergency contacts
          </h2>
          <p className="mt-1 text-base text-text-muted">
            {userName} can call these from their Help screen with one tap.
          </p>
        </div>
        {!draft ? (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setDraft({ id: null, name: "", phone: "", relationship: "" });
            }}
            icon={<Plus className="size-5" aria-hidden />}
          >
            Add contact
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold">
              {draft.id ? "Edit contact" : "Add a contact"}
            </h3>
            <button
              type="button"
              onClick={() => setDraft(null)}
              aria-label="Cancel"
              className="rounded-lg p-1.5 text-text-muted hover:bg-surface-alt"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Name</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={60}
                className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">Phone number</span>
              <input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                inputMode="tel"
                maxLength={30}
                className="rounded-xl border-2 border-border-strong bg-surface px-4 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
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
          </div>
          {error ? (
            <p role="alert" className="mt-3 text-base font-medium text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex gap-3">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save contact"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {contacts.length === 0 && !draft ? (
        <p className="mt-5 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-8 text-center text-text-muted">
          No emergency contact yet. Add one so the Help screen has someone to
          call.
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-soft"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-lg font-semibold">{c.name}</span>
                <span className="text-sm text-text-muted">
                  {c.relationship} · {c.phone}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: c.id,
                      name: c.name,
                      phone: c.phone,
                      relationship: c.relationship,
                    })
                  }
                  icon={<Pencil className="size-4" aria-hidden />}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => remove(c)}
                  icon={<Trash2 className="size-4" aria-hidden />}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
