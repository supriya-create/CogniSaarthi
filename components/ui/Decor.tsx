import { cn } from "@/lib/utils/cn";

/**
 * Decorative background art.
 *
 * Every shape here is drawn from something that is actually around
 * people in the region the app is for — the terraced tea rows, the
 * hills behind them, a sprig of leaf, the foxtail orchid. They are
 * kept to line work at low opacity, sitting behind content rather
 * than competing with it: the point is that a screen feels like a
 * place, not that anyone stops to look at a picture.
 *
 * All of it is `aria-hidden` and none of it ever carries meaning.
 */

/** Rolling tea-garden hills. Sits along the bottom edge of a hero. */
export function HillsDecor({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 140"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full", className)}
      aria-hidden
      focusable="false"
    >
      <path
        d="M0 140V86c48-26 96-30 144-12s96 24 144 2 96-40 144-30 120 42 168 50v44z"
        fill="var(--c-primary)"
        opacity="0.07"
      />
      <path
        d="M0 140v-28c60-18 108-10 156 10s96 22 150 2 108-32 168-18 78 22 126 26v8z"
        fill="var(--c-primary)"
        opacity="0.1"
      />
    </svg>
  );
}

/** A sprig of two-leaves-and-a-bud, the tea picker's measure. */
export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      // No `-z-10` here, unlike every earlier version of this file.
      // It made the sprig invisible wherever it is used as an ICON
      // rather than as background — inside the empty-state plate and
      // Memory Lane's intro badge it sat behind the plate's own fill,
      // leaving a blank circle. The decorative uses are all absolutely
      // positioned BEFORE their sibling content, so source order
      // already puts them behind it, and `OrchidSprig` beside this one
      // has never needed the negative index either.
      className={cn("pointer-events-none size-32", className)}
      aria-hidden
      focusable="false"
    >
      <g
        fill="none"
        stroke="var(--c-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.5"
      >
        <path d="M60 112V38" />
        <path d="M60 74c-18 0-30-10-32-28 20-4 34 6 32 28Z" />
        <path d="M60 58c18-2 29-13 29-31-20-3-33 8-29 31Z" />
        <path d="M60 38c7-5 10-13 8-23-9 2-13 10-8 23Z" />
      </g>
    </svg>
  );
}

/** Foxtail orchid — Assam's flower — reduced to a repeating arc of buds. */
export function OrchidSprig({ className }: { className?: string }) {
  const buds = [0, 1, 2, 3, 4, 5];
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn("pointer-events-none size-32", className)}
      aria-hidden
      focusable="false"
    >
      <path
        d="M22 18c26 14 44 40 52 82"
        fill="none"
        stroke="var(--c-secondary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.4"
      />
      {buds.map((i) => {
        const t = i / (buds.length - 1);
        const x = 22 + 52 * t + 8 * t * t;
        const y = 18 + 82 * t * t + 12 * t;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={4 + i * 0.8}
            fill="var(--c-secondary)"
            opacity="0.28"
          />
        );
      })}
    </svg>
  );
}

/**
 * A soft radial wash. Used behind hero sections to give the top of a
 * page some depth without a hard-edged gradient band.
 */
export function GlowDecor({
  className,
  tone = "primary",
}: {
  className?: string;
  tone?: "primary" | "secondary" | "accent";
}) {
  const colour = {
    primary: "var(--wash-a)",
    secondary: "var(--wash-b)",
    accent: "var(--wash-c)",
  }[tone];

  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-3xl",
        className,
      )}
      style={{ backgroundColor: colour }}
    />
  );
}

/**
 * Bamboo-weave pattern, the texture of a `japi` or a basket. Tiled as
 * an SVG pattern so it stays crisp at any text scale.
 */
export function WeaveDecor({ className }: { className?: string }) {
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      aria-hidden
      focusable="false"
    >
      <defs>
        <pattern
          id="weave"
          width="26"
          height="26"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path
            d="M0 13h26M13 0v26"
            stroke="var(--c-border-strong)"
            strokeWidth="1"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#weave)" />
    </svg>
  );
}
