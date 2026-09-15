"use client";

import { Check } from "lucide-react";
import type { Language } from "@prisma/client";

import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

/**
 * Language choice as three large tappable rows rather than a select
 * menu. Each option is written in its own script first, so a person
 * who reads only Assamese can find it without reading English.
 */
export function LanguageSelector({
  value,
  onChange,
  name = "language",
}: {
  value: Language;
  onChange: (language: Language) => void;
  name?: string;
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-3">
      {LANGUAGES.map((language) => {
        const selected = value === language.code;
        return (
          <label
            key={language.code}
            className={cn(
              "flex min-h-[4.5rem] cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-4",
              "transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out-soft",
              selected
                ? "border-primary bg-primary-soft shadow-lift"
                : "border-border bg-surface shadow-soft hover:border-border-strong hover:bg-surface-alt",
            )}
          >
            <input
              type="radio"
              name={name}
              value={language.code}
              checked={selected}
              onChange={() => onChange(language.code)}
              className="sr-only"
            />

            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                selected
                  ? "border-primary bg-primary text-text-inverse"
                  : "border-border-strong bg-surface",
              )}
            >
              {selected ? <Check className="size-5" strokeWidth={3} /> : null}
            </span>

            <span className="flex min-w-0 flex-col">
              <span className="text-2xl font-semibold leading-tight">
                {language.nativeLabel}
              </span>
              {language.nativeLabel !== language.label ? (
                <span className="text-base text-text-muted">
                  {language.label}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
