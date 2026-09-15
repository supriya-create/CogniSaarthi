import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Variant =
  | "primary"
  | "secondary"
  | "soft"
  | "quiet"
  | "outline"
  | "danger";
type Size = "xl" | "lg" | "md" | "sm";

/**
 * Filled variants use a two-stop gradient rather than a flat colour.
 * It is a two-percent difference in lightness — invisible as a
 * gradient, but it is what stops a large button reading as a
 * rectangle of paint.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "border-primary bg-primary bg-[image:linear-gradient(160deg,var(--c-primary)_0%,var(--c-primary-strong)_100%)] " +
    "text-text-inverse shadow-soft hover:border-primary-strong hover:shadow-lift",
  secondary:
    "border-secondary bg-secondary bg-[image:linear-gradient(160deg,var(--c-secondary)_0%,var(--c-secondary-strong)_100%)] " +
    "text-text-inverse shadow-soft hover:border-secondary-strong hover:shadow-lift",
  soft:
    "border-primary/20 bg-primary-soft text-primary shadow-none hover:border-primary/40 hover:bg-primary-soft",
  outline:
    "border-border-strong bg-surface text-text shadow-soft hover:border-primary/50 hover:bg-primary-tint hover:shadow-lift",
  quiet:
    "border-transparent bg-transparent text-text-muted shadow-none hover:bg-surface-alt hover:text-text",
  danger:
    "border-error/40 bg-surface text-error shadow-none hover:bg-error-soft hover:border-error/60",
};

/**
 * Sizes are generous by default: `lg` is the elderly interface
 * standard and clears a 64px touch target at the base text scale.
 * `xl` is for the single most important action on a screen. `sm`
 * exists only for the caregiver dashboard on a desktop.
 */
const SIZES: Record<Size, string> = {
  xl: "min-h-[4rem] px-8 py-4.5 text-xl gap-3 rounded-2xl",
  lg: "min-h-[3.5rem] px-7 py-4 text-xl gap-3 rounded-2xl",
  md: "min-h-[3rem] px-5 py-3 text-lg gap-2.5 rounded-xl",
  sm: "min-h-[2.5rem] px-4 py-2 text-base gap-2 rounded-lg",
};

const BASE =
  "group/btn relative inline-flex items-center justify-center border-2 font-semibold " +
  "transition-[background-color,border-color,transform,box-shadow,color] duration-200 ease-gentle " +
  "active:translate-y-px disabled:pointer-events-none disabled:shadow-none " +
  // A disabled control keeps readable text: fading the whole button to
  // 55% drops a light label on a light fill below AA, which is exactly
  // when someone most needs to read why nothing is happening.
  "disabled:border-border disabled:bg-none disabled:bg-surface-alt disabled:text-text-muted " +
  "text-center leading-snug cursor-pointer select-none";

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
