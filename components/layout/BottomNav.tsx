"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ListChecks, UserRound } from "lucide-react";
import type { Language, SpeechRate } from "@prisma/client";

import { cn } from "@/lib/utils/cn";
import type { Dict } from "@/lib/i18n/dictionaries";
import { VoiceButton } from "@/components/elderly/VoiceButton";

/**
 * Three destinations, permanently visible, labelled in words.
 *
 * Deliberately not a hamburger, a drawer or a tab bar of six —
 * a person should be able to see every place they can go without
 * opening anything.
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

  const items = [
    { href: "/home", label: dict.home, Icon: House },
    { href: "/history", label: dict.navHistory, Icon: ListChecks },
    { href: "/profile", label: dict.navProfile, Icon: UserRound },
  ];

  return (
    <>
      {voice ? (
        <VoiceButton
          language={voice.language}
          speechRate={voice.speechRate}
        />
      ) : null}
      <nav
        aria-label={dict.quickActions}
        className="sticky bottom-0 z-30 border-t border-border bg-surface/97 backdrop-blur-sm"
      >
      <ul className="mx-auto flex max-w-3xl items-stretch">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[4rem] flex-col items-center justify-center gap-1 px-2 py-2",
                  "text-sm font-semibold transition-colors duration-150",
                  active
                    ? "text-primary"
                    : "text-text-muted hover:text-text",
                )}
              >
                <Icon
                  className="size-7"
                  strokeWidth={active ? 2.4 : 2}
                  aria-hidden
                />
                <span className="text-center leading-tight">{label}</span>
                {/* The active tab is marked by weight, colour AND a bar. */}
                <span
                  aria-hidden
                  className={cn(
                    "h-1 w-8 rounded-full",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
        </ul>
      </nav>
    </>
  );
}
