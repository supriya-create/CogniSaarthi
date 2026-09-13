import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "quiet" | "outline" | "danger";
type Size = "lg" | "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-text-inverse border-primary hover:bg-primary-strong hover:border-primary-strong shadow-soft",
  secondary:
    "bg-secondary text-text-inverse border-secondary hover:bg-secondary-strong hover:border-secondary-strong shadow-soft",
  outline:
    "bg-surface text-text border-border-strong hover:bg-surface-alt shadow-soft",
  quiet:
    "bg-transparent text-text border-transparent hover:bg-surface-alt shadow-none",
  danger:
    "bg-surface text-error border-error/40 hover:bg-error-soft shadow-none",
};

/**
 * Sizes are generous by default: `lg` is the elderly interface
 * standard and clears a 64px touch target at the base text scale.
 * `sm` exists only for the caregiver dashboard on a desktop.
 */
const SIZES: Record<Size, string> = {
  lg: "min-h-[3.5rem] px-7 py-4 text-xl gap-3",
  md: "min-h-[3rem] px-5 py-3 text-lg gap-2.5",
  sm: "min-h-[2.5rem] px-4 py-2 text-base gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-xl border-2 font-semibold " +
  "transition-[background-color,border-color,transform] duration-150 ease-gentle " +
  "active:translate-y-px disabled:opacity-55 disabled:pointer-events-none " +
  "text-center leading-snug cursor-pointer";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps>;

export function Button({
  variant = "primary",
  size = "lg",
  fullWidth,
  icon,
  trailingIcon,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {trailingIcon}
    </button>
  );
}

type LinkButtonProps = CommonProps & { href: string; prefetch?: boolean };

export function LinkButton({
  href,
  variant = "primary",
  size = "lg",
  fullWidth,
  icon,
  trailingIcon,
  children,
  className,
  prefetch,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {icon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
