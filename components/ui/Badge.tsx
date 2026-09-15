import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone =
  | "neutral"
  | "primary"
  | "secondary"
  | "accent"
  | "success"
  | "warning"
  | "error";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-alt text-text-muted border-border",
  primary: "bg-primary-soft text-primary border-primary/20",
  secondary: "bg-secondary-soft text-secondary border-secondary/20",
  accent: "bg-accent-soft text-warning border-accent/25",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/30",
  error: "bg-error-soft text-error border-error/25",
};

/**
 * A small status pill. Every tone is paired with words by the caller
 * and usually an icon too — colour on its own is never the message.
 */
export function Badge({
  children,
  tone = "neutral",
  icon,
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-0.5 text-sm" : "px-3 py-1 text-base",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
