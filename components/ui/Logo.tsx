import { cn } from "@/lib/utils/cn";

/**
 * The Cognisaarthi mark.
 *
 * A marigold — the flower strung across doorways at home across the
 * region — with a leaf held beside it. Drawn by hand rather than
 * pulled from an icon set, so the product has a face of its own.
 * `saarthi` means companion, and the leaf is the companion to the
 * flower; that is the whole idea of the mark.
 */
export function LogoMark({ className }: { className?: string }) {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("size-10", className)}
      aria-hidden
      focusable="false"
    >
      {/* Outer ring of petals, set behind and rotated half a step so
          the flower reads as layered rather than flat. */}
      {petals.map((angle) => (
        <ellipse
          key={`outer-${angle}`}
          cx="24"
          cy="11"
          rx="5.4"
          ry="9.4"
          fill="var(--c-accent)"
          opacity="0.55"
          transform={`rotate(${angle + 22.5} 24 24)`}
        />
      ))}
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="24"
          cy="12.5"
          rx="5.6"
          ry="9.6"
          fill="var(--c-accent)"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="7.6" fill="var(--c-primary)" />
      <circle cx="24" cy="24" r="3.1" fill="var(--c-accent-soft)" />
    </svg>
  );
}

export function Wordmark({
  className,
  size = "md",
}: {
  className?: string;
  /** `sm` for dense caregiver chrome, `lg` for onboarding and sign-in. */
  size?: "sm" | "md" | "lg";
}) {
  const marks = { sm: "size-7", md: "size-9", lg: "size-12" } as const;
  const words = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" } as const;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={cn("shrink-0", marks[size])} />
      <span
        className={cn(
          "font-serif font-semibold tracking-tight text-text",
          words[size],
        )}
      >
        Cognisaarthi
      </span>
    </span>
  );
}

/**
 * The wordmark with the promise underneath it. Used on the screens
 * where someone meets the product for the first time — onboarding,
 * sign-in, sign-up — and nowhere else.
 */
export function BrandLockup({
  tagline,
  className,
}: {
  tagline: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      <LogoMark className="size-16" />
      <p className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Cognisaarthi
      </p>
      <p className="mt-2 max-w-xs text-lg leading-snug text-text-muted">
        {tagline}
      </p>
    </div>
  );
}
