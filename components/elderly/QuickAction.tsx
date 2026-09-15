import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type Tone = "primary" | "secondary" | "tea" | "sage";

const PLATE: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary border-primary/20",
  secondary: "bg-secondary-soft text-secondary border-secondary/20",
  tea: "bg-accent-soft text-warning border-accent/30",
  sage: "bg-sage-soft text-primary border-sage/30",
};

/**
 * One of the tiles under "Your day" on the home screen.
 *
 * The icon plate is what gives the grid its rhythm, and the tone
 * rotates so no two neighbouring tiles read the same. When a feature
 * is not built yet it renders as a plainly disabled tile carrying the
 * words "Coming soon" — never as a live-looking button that does
 * nothing.
 */
export function QuickAction({
  href,
  label,
  description,
  Icon,
  tone = "primary",
  comingSoon,
  comingSoonLabel,
  emphasis,
}: {
  href: string;
  label: string;
  description?: string;
  Icon: LucideIcon;
  tone?: Tone;
  comingSoon?: boolean;
  comingSoonLabel?: string;
  /** Wider, higher-contrast treatment for a tile that leads a row. */
  emphasis?: boolean;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-200 ease-out-soft",
          comingSoon ? "border-border bg-surface-alt text-text-muted" : PLATE[tone],
          !comingSoon && "group-hover/tile:scale-105",
        )}
      >
        <Icon className="size-7" strokeWidth={2} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lg leading-tight font-semibold">{label}</span>
        {comingSoon ? (
          <span className="mt-1 text-base font-medium text-text-muted">
            {comingSoonLabel}
          </span>
        ) : description ? (
          <span className="mt-1 text-base leading-snug text-text-muted">
            {description}
          </span>
        ) : null}
      </span>

      {!comingSoon ? (
        <ArrowRight
          aria-hidden
          className="size-5 shrink-0 self-center text-text-muted opacity-0 transition-all duration-200 ease-gentle group-hover/tile:translate-x-0.5 group-hover/tile:opacity-100"
        />
      ) : null}
    </>
  );

  const shared =
    "group/tile flex min-h-[6.5rem] items-center gap-4 rounded-2xl border p-4 text-left sm:p-5";

  if (comingSoon) {
    return (
      <div
        aria-disabled="true"
        className={cn(shared, "border-border bg-surface-alt/60 text-text-muted")}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        shared,
        "panel-interactive shadow-soft",
        emphasis
          ? "surface-glow border-primary/20"
          : "border-border bg-surface",
      )}
    >
      {inner}
    </Link>
  );
}
