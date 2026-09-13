import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone = "surface" | "alt" | "primary" | "secondary" | "success" | "warning";

const TONES: Record<Tone, string> = {
  surface: "bg-surface border-border",
  alt: "bg-surface-alt border-border",
  primary: "bg-primary-soft border-primary/25",
  secondary: "bg-secondary-soft border-secondary/25",
  success: "bg-success-soft border-success/25",
  warning: "bg-warning-soft border-warning/30",
};

export function Card({
  children,
  tone = "surface",
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border p-6 shadow-soft",
        TONES[tone],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
