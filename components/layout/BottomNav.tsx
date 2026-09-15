"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Language, SpeechRate } from "@prisma/client";

import { ELDER_NAV, isCurrent } from "@/components/layout/elder-nav";
import { VoiceButton } from "@/components/elderly/VoiceButton";
import type { Dict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

/**
 * The phone navigation: four destinations, permanently visible,
 * labelled in words.
 *
 * Deliberately not a hamburger, a drawer, or a tab bar of eight — a
 * person should be able to see where they can go without opening
 * anything. The remaining destinations are on the home screen and in
 * the wide navigation in the header.
 *
 * The current tab is marked four ways over: an `aria-current`, a
 * filled pill behind the icon, a heavier label, and a colour change.
 * Colour is never carrying it alone.
 */
export function BottomNav({
  dict,
  voice,
}: {
  dict: Dict;
  /** When present, a floating voice control is shown above the nav. */
  voice?: { language: Language; speechRate: SpeechRate };
}) {
  const pathname = usePathname();
  const items = ELDER_NAV.filter((item) => item.primary);

  return (
    <>
      {voice ? (
        <VoiceButton language={voice.language} speechRate={voice.speechRate} />
      ) : null}

      <nav
        aria-label={dict.quickActions}
        className={cn(
          "sticky bottom-0 z-30 border-t border-border md:hidden",
          // Translucent so content scrolling underneath stays sensed
          // rather than hidden behind a hard bar.
          "bg-surface/90 backdrop-blur-xl",
          // Clears the home indicator on a modern phone.
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <ul className="mx-auto flex max-w-3xl items-stretch px-2 py-1.5">
          {items.map(({ href, labelKey, Icon }) => {
            const active = isCurrent(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5",
                    "text-sm transition-colors duration-200 ease-gentle",
                    active
                      ? "font-bold text-primary"
                      : "font-semibold text-text-muted hover:bg-surface-alt hover:text-text",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-9 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out-soft",
                      active
                        ? "scale-100 bg-primary-soft"
                        : "scale-95 bg-transparent",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
                  </span>
                  <span className="text-center leading-tight">
                    {dict[labelKey]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/**
 * The wide navigation, shown from tablet width up inside the header.
 *
 * Profile is deliberately absent: it lives as its own control in the
 * top row of the header, the way an account menu does everywhere
 * else, which is also what keeps the remaining seven pills inside the
 * reading column instead of scrolling off the end of it.
 */
export function ElderNavBar({ dict }: { dict: Dict }) {
  const pathname = usePathname();
  const items = ELDER_NAV.filter((item) => item.href !== "/profile");

  return (
    <nav
      aria-label={dict.quickActions}
      className="scrollbar-none hidden overflow-x-auto md:block"
    >
      <ul className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 pb-2.5 sm:px-6">
        {items.map(({ href, labelKey, Icon }) => {
          const active = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[2.75rem] items-center gap-2 rounded-full px-3 py-2 text-base whitespace-nowrap",
                  "transition-[background-color,color,box-shadow] duration-200 ease-gentle",
                  active
                    ? "bg-primary-soft font-bold text-primary shadow-soft"
                    : "font-semibold text-text-muted hover:bg-surface-alt hover:text-text",
                )}
              >
                <Icon
                  className="size-5 shrink-0"
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden
                />
                {dict[labelKey]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
