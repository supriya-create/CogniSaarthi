import { Info } from "lucide-react";

/**
 * A plain-language account of how the personalisation works, for the
 * caregiver. Its last line is the important one: this is not a
 * diagnostic tool. Keeping that promise visible is part of the
 * product, not boilerplate.
 */
export function PersonalisationExplainer() {
  const points = [
    "It looks at how recent activities went — how many answers were right.",
    "It considers response time and how steady the results have been.",
    "It adjusts the difficulty of the next activity gradually, one step at a time.",
    "It suggests a little more practice in areas that have been more challenging.",
    "It does not diagnose any medical condition, and these scores are not a medical measurement.",
  ];

  return (
    <section className="mt-9 rounded-2xl border border-border bg-surface-alt/60 p-6">
      <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
        <Info className="size-5 shrink-0 text-secondary" aria-hidden />
        How Cognisaarthi personalises activities
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {points.map((point) => (
          <li key={point} className="flex items-start gap-3 text-base leading-relaxed">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full bg-secondary"
            />
            <span
              className={
                point.startsWith("It does not")
                  ? "font-medium text-text"
                  : "text-text-muted"
              }
            >
              {point}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
