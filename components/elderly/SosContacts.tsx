"use client";

import { useState } from "react";
import { Phone, PhoneCall, UserRoundX } from "lucide-react";
import type { Language } from "@prisma/client";

import { EmptyState } from "@/components/ui/EmptyState";
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
      <div className="mt-8">
        <EmptyState
          title={dict.sosNoContact}
          body={dict.sosContactLabel}
          icon={<UserRoundX className="size-10" aria-hidden />}
        />
      </div>
    );
  }

  return (
    <ul className="stagger mt-7 flex flex-col gap-4">
      {contacts.map((contact) => {
        const open = confirming === contact.id;
        return (
          <li
            key={contact.id}
            className="panel border-2 p-5 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="flex size-16 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary-soft text-primary shadow-soft"
              >
                <Phone className="size-8" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-serif text-2xl leading-tight font-semibold">
                  {contact.name}
                </span>
                <span className="mt-0.5 text-lg text-text-muted">
                  {contact.relationship}
                </span>
              </div>
            </div>

            {open ? (
              <div className="animate-fade-up mt-5 rounded-2xl border border-border bg-surface-alt/70 p-4">
                <p className="text-lg font-semibold">{dict.sosConfirmTitle}</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex min-h-[4rem] flex-1 items-center justify-center gap-3 rounded-2xl border-2 border-primary bg-primary bg-[image:linear-gradient(160deg,var(--c-primary)_0%,var(--c-primary-strong)_100%)] px-7 py-4 text-xl font-semibold text-text-inverse shadow-lift transition-transform duration-200 ease-gentle active:translate-y-px"
                  >
                    <PhoneCall className="size-6" aria-hidden />
                    {dict.sosCallLabel} {contact.name}
                  </a>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="inline-flex min-h-[4rem] flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 border-border-strong bg-surface px-7 py-4 text-xl font-semibold shadow-soft transition-colors duration-200 hover:bg-surface-alt"
                  >
                    {dict.sosCancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(contact.id)}
                className="mt-5 inline-flex min-h-[4rem] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-primary bg-primary bg-[image:linear-gradient(160deg,var(--c-primary)_0%,var(--c-primary-strong)_100%)] px-7 py-4 text-xl font-semibold text-text-inverse shadow-lift transition-[transform,box-shadow] duration-200 ease-gentle hover:shadow-float active:translate-y-px"
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
