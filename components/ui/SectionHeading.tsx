import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The heading pattern used down every page: an optional eyebrow, the
 * heading itself, an optional supporting line, and an optional action
 * pinned to the right. Having one component for this is what keeps
 * the vertical rhythm identical from the home screen to the caregiver
 * dashboard.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  size = "md",
  className,
  as: Tag = "h2",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-3xl sm:text-4xl",
  } as const;

  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1.5 text-sm font-semibold tracking-[0.12em] text-text-muted uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag className={cn("font-serif font-semibold", sizes[size])}>
          {title}
        </Tag>
        {description ? (
          <p className="mt-2 max-w-prose text-lg leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
