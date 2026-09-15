import { Info } from "lucide-react";
import type { Language } from "@prisma/client";

import { getCaregiverDict } from "@/lib/i18n/caregiver";

/**
 * A plain-language account of how the personalisation works, for the
 * caregiver. Its last line is the important one: this is not a
 * diagnostic tool. Keeping that promise visible is part of the
 * product, not boilerplate.
 */
export function PersonalisationExplainer({
  language,
}: {
  language: Language;
}) {
  const dict = getCaregiverDict(language);
  const points = [
    dict.explainerPoint1,
    dict.explainerPoint2,
    dict.explainerPoint3,
    dict.explainerPoint4,
  ];
  // The last point is the promise the product is built on, so it is
  // rendered emphasised and separately rather than relying on an
  // English prefix match, which no translation would satisfy.
  const notDiagnostic = dict.explainerPoint5;

  return (
    <section className="panel mt-10 bg-surface-alt/60 p-6">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
        <Info className="size-5 shrink-0 text-secondary" aria-hidden />
        {dict.explainerTitle}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-base leading-relaxed">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary"
            />
            <span className="text-text-muted">{point}</span>
          </li>
        ))}
        <li className="flex items-start gap-3 text-base leading-relaxed">
          <span
            aria-hidden
            className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary"
          />
          <span className="font-medium text-text">{notDiagnostic}</span>
        </li>
      </ul>
    </section>
  );
}
