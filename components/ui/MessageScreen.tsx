import type { ReactNode } from "react";

import { GlowDecor, HillsDecor, LeafSprig } from "@/components/ui/Decor";
import { LogoMark } from "@/components/ui/Logo";

/**
 * The full-screen "something has happened" layout, shared by the
 * error and not-found pages.
 *
 * One plain sentence, one thing to press, and nothing technical: no
 * stack trace, no digest, no status code. The real error still goes
 * to the console and the server log, where the people who can act on
 * it will find it.
 */
export function MessageScreen({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="app-canvas relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <GlowDecor className="-top-32 left-1/2 size-96 -translate-x-1/2" />
      <LeafSprig className="absolute top-10 -left-10 !size-64 -rotate-12 opacity-[0.1]" />
      <HillsDecor className="h-28 opacity-60" />

      <div className="relative flex max-w-md flex-col items-center">
        <LogoMark className="size-20" />
        <h1 className="mt-8 font-serif text-3xl font-semibold sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3.5 text-xl leading-relaxed text-text-muted">{body}</p>
        <div className="mt-9 w-full max-w-xs">{action}</div>
      </div>
    </div>
  );
}
