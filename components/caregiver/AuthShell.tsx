import type { ReactNode } from "react";

import { GlowDecor, HillsDecor, LeafSprig } from "@/components/ui/Decor";
import { LogoMark } from "@/components/ui/Logo";

/**
 * The sign-in and sign-up frame.
 *
 * These are the two screens where a family member meets the product
 * for the first time, so they carry the brand properly: the mark, the
 * name, and the same warm background the rest of the app uses. A bare
 * form on a white page would be the first impression otherwise.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-5 py-12">
      <GlowDecor className="-top-32 -left-24 size-96" />
      <GlowDecor className="-top-20 -right-24 size-80" tone="secondary" />
      <LeafSprig className="absolute top-16 -left-12 !size-64 -rotate-12 opacity-[0.12]" />
      <HillsDecor className="h-28 opacity-70" />

      <main id="main" className="relative w-full max-w-md">
        <div className="text-center">
          <LogoMark className="mx-auto size-16" />
          <p className="mt-3 font-serif text-2xl font-semibold tracking-tight">
            Cognisaarthi
          </p>
          <h1 className="mt-7 font-serif text-3xl font-semibold">{title}</h1>
          <p className="mt-2.5 text-lg leading-relaxed text-text-muted">
            {subtitle}
          </p>
        </div>

        <div className="panel mt-8 p-6 sm:p-7">{children}</div>

        {footer ? (
          <div className="mt-6 text-center text-base text-text-muted">
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  );
}
