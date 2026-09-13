import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

type Tone = "primary" | "secondary" | "tea";

const TONES: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary border-primary/20",
  secondary: "bg-secondary-soft text-secondary border-secondary/20",
  tea: "bg-accent-soft text-warning border-accent/30",
};

/**
 * One of the four tiles on the home screen.
 *
 * When a feature is not built yet it renders as a plainly disabled
 * tile carrying the words "Coming soon" — never as a live-looking
 * button that does nothing.
 */
export function QuickAction({
  href,
  label,
  Icon,
  tone = "primary",
  comingSoon,
  comingSoonLabel,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  tone?: Tone;
  comingSoon?: boolean;
  comingSoonLabel?: string;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-xl border",
          comingSoon ? "border-border bg-surface-alt text-text-muted" : TONES[tone],
        )}
      >
        <Icon className="size-7" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col items-start">
        <span className="text-lg font-semibold leading-tight">{label}</span>
        {comingSoon ? (
          <span className="mt-0.5 text-sm font-medium text-text-muted">
            {comingSoonLabel}
          </span>
        ) : null}
      </span>
    </>
  );

  const shared =
    "flex min-h-[6rem] items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-150 ease-gentle";

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
        "border-border bg-surface shadow-soft hover:border-border-strong hover:bg-surface-alt",
      )}
    >
      {inner}
    </Link>
  );
}
