"use client";

import { useState } from "react";
import { Phone, PhoneCall } from "lucide-react";
import type { Language } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";

/**
 * Emergency contacts the elder can dial with one tap. This is a contact
 * card and a phone dial only — tapping Call opens the phone dialler.
 * Cognisaarthi never says it has contacted anyone or dispatched help,
 * because it does neither. A confirm step guards against an accidental
 * tap.
 */

export interface SosContactDTO {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function SosContacts({
  contacts,
  language,
}: {
  contacts: SosContactDTO[];
  language: Language;
}) {
  const dict = getDict(language);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (contacts.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-12 text-center text-xl text-text-muted">
        {dict.sosNoContact}
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col gap-4">
      {contacts.map((contact) => {
        const open = confirming === contact.id;
        return (
          <li
            key={contact.id}
            className="rounded-2xl border-2 border-border bg-surface p-5 shadow-soft"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
              >
                <Phone className="size-7" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-2xl font-semibold">{contact.name}</span>
                <span className="text-lg text-text-muted">
                  {contact.relationship}
                </span>
              </div>
            </div>

            {open ? (
              <div className="mt-4">
                <p className="text-lg font-medium">
                  {dict.sosConfirmTitle}
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center gap-3 rounded-xl border-2 border-primary bg-primary px-7 py-4 text-xl font-semibold text-text-inverse shadow-soft"
                  >
                    <PhoneCall className="size-6" aria-hidden />
                    {dict.sosCallLabel} {contact.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="inline-flex min-h-[3.5rem] flex-1 items-center justify-center rounded-xl border-2 border-border-strong bg-surface px-7 py-4 text-xl font-semibold"
                  >
                    {dict.sosCancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(contact.id)}
                className="mt-4 inline-flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-xl border-2 border-primary bg-primary px-7 py-4 text-xl font-semibold text-text-inverse shadow-soft"
              >
                <PhoneCall className="size-6" aria-hidden />
                {dict.sosCallLabel}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
