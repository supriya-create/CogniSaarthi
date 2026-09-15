import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone =
  | "surface"
  | "alt"
  | "glow"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "outline";

const TONES: Record<Tone, string> = {
  surface: "bg-surface border-border",
  alt: "bg-surface-alt border-border",
  glow: "surface-glow border-primary/15",
  primary: "bg-primary-soft border-primary/25",
  secondary: "bg-secondary-soft border-secondary/25",
  success: "bg-success-soft border-success/25",
  warning: "bg-warning-soft border-warning/30",
  error: "bg-error-soft border-error/30",
  outline: "bg-transparent border-dashed border-border-strong",
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
} as const;

/**
 * The shared container.
 *
 * `interactive` is for cards that are themselves a link or a button —
 * it adds the hover lift and the press settle. A card that only holds
 * content should never move, because movement is how this interface
 * says "you can press this".
 */
export function Card({
  children,
  tone = "surface",
  padding = "md",
  interactive,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  tone?: Tone;
  padding?: keyof typeof PADDING;
  interactive?: boolean;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "aside";
}) {
  return (
    <Tag
      className={cn(
        "relative rounded-2xl border",
        tone === "outline" ? "shadow-none" : "shadow-soft",
        TONES[tone],
        PADDING[padding],
        interactive && "panel-interactive",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * A card that leads with a coloured icon plate. The plate is what
 * gives a column of cards a rhythm — without it every card is a
 * rectangle of text and the eye has nothing to catch on.
 */
export function CardIcon({
  children,
  tone = "primary",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "secondary" | "accent" | "success" | "sage" | "muted";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary border-primary/15",
    secondary: "bg-secondary-soft text-secondary border-secondary/15",
    accent: "bg-accent-soft text-warning border-accent/25",
    success: "bg-success-soft text-success border-success/20",
    sage: "bg-sage-soft text-primary border-sage/25",
    muted: "bg-surface-alt text-text-muted border-border",
  } as const;

  const sizes = {
    sm: "size-11 rounded-xl",
    md: "size-14 rounded-2xl",
    lg: "size-16 rounded-2xl",
  } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center border",
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
