"use client";

import { Check } from "lucide-react";
import type { FontScale } from "@prisma/client";

import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

const OPTIONS: Array<{
  value: FontScale;
  key: keyof Dict;
  /** The sample renders at the size the choice actually produces. */
  sample: string;
}> = [
  { value: "COMFORTABLE", key: "textSizeComfortable", sample: "text-lg" },
  { value: "LARGE", key: "textSizeLarge", sample: "text-2xl" },
  { value: "EXTRA_LARGE", key: "textSizeExtraLarge", sample: "text-4xl" },
];

/**
 * Text size shown as a preview rather than a number. Someone
 * choosing this is doing so because reading is hard; "1.25×" is not
 * a useful thing to ask them to imagine.
 */
export function TextSizeSelector({
  value,
  onChange,
  dict,
}: {
  value: FontScale;
  onChange: (value: FontScale) => void;
  dict: Dict;
}) {
  return (
    <div role="radiogroup" aria-label={dict.profileTextSize} className="flex flex-col gap-3">
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex min-h-[4rem] cursor-pointer items-center gap-4 rounded-2xl border-2 px-5 py-3",
              "transition-colors duration-150 ease-gentle",
              selected
                ? "border-primary bg-primary-soft"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <input
              type="radio"
              name="fontScale"
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-2",
                selected
                  ? "border-primary bg-primary text-text-inverse"
                  : "border-border-strong bg-surface",
              )}
            >
              {selected ? <Check className="size-4" strokeWidth={3} /> : null}
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <span className="text-lg font-semibold">{dict[option.key]}</span>
              <span
                aria-hidden
                className={cn("font-serif leading-none", option.sample)}
              >
                Aa
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
