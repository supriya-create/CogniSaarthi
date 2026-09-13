import { cn } from "@/lib/utils/cn";

/**
 * The Cognisaarthi mark: a marigold, the flower strung across
 * doorways at home across the region. Drawn by hand rather than
 * pulled from an icon set so the product has a face of its own.
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
      {petals.map((angle) => (
        <ellipse
          key={angle}
          cx="24"
          cy="12.5"
          rx="6"
          ry="10"
          fill="var(--color-accent)"
          transform={`rotate(${angle} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="7.5" fill="var(--color-primary)" />
      <circle cx="24" cy="24" r="3" fill="var(--color-accent-soft)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8 shrink-0" />
      <span className="font-serif text-2xl font-semibold tracking-tight text-text">
        Cognisaarthi
      </span>
    </span>
  );
}
