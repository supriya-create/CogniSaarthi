"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BellRing,
  Home,
  Images,
  NotebookPen,
  Settings,
  Sprout,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Language } from "@prisma/client";

import { getCaregiverDict, type CaregiverDict } from "@/lib/i18n/caregiver";
import { cn } from "@/lib/utils/cn";

/**
 * Caregiver section navigation.
 *
 * Denser than the elder navigation — this is the informative side of
 * the product — but still labelled in words, never bare icons. It
 * renders two ways from one list: a rail down the left on a laptop,
 * and a scrollable row of pills above the content on anything
 * narrower.
 */

/** Labels are keys, resolved per render, so the rail follows the
    caregiver's own language choice. */
const ITEMS: {
  href: string;
  labelKey: keyof CaregiverDict;
  Icon: LucideIcon;
}[] = [
  { href: "/caregiver", labelKey: "navOverview", Icon: Home },
  { href: "/caregiver/reminders", labelKey: "navReminders", Icon: Bell },
  { href: "/caregiver/alerts", labelKey: "navAlerts", Icon: BellRing },
  { href: "/caregiver/notes", labelKey: "navNotes", Icon: NotebookPen },
  { href: "/caregiver/summary", labelKey: "navSummary", Icon: TrendingUp },
  { href: "/caregiver/memories", labelKey: "navMemories", Icon: Images },
  {
    href: "/caregiver/memory-lane",
    labelKey: "navMemoryLane",
    Icon: Sprout,
  },
  { href: "/caregiver/settings", labelKey: "navSettings", Icon: Settings },
];

function isCurrent(pathname: string, href: string) {
  return href === "/caregiver"
    ? pathname === "/caregiver"
    : pathname.startsWith(href);
}

/** The left rail, shown from `lg` up. */
export function CaregiverNav({ language }: { language: Language }) {
  const pathname = usePathname();
  const dict = getCaregiverDict(language);

  return (
    <nav aria-label={dict.navSections}>
      <ul className="flex flex-col gap-1">
        {ITEMS.map(({ href, labelKey, Icon }) => {
          const active = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[2.75rem] items-center gap-3 rounded-xl py-2.5 pr-3 pl-4 text-base font-semibold",
                  "transition-[background-color,color] duration-200 ease-gentle",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-text-muted hover:bg-surface-alt hover:text-text",
                )}
              >
                {/* A marker bar as well as the fill, so the current
                    section survives a low-contrast screen. */}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-full",
                    active ? "bg-primary" : "bg-transparent",
                  )}
                />
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

/** The scrollable pill row, shown below `lg`. */
export function CaregiverNavBar({ language }: { language: Language }) {
  const pathname = usePathname();
  const dict = getCaregiverDict(language);

  return (
    <nav
      aria-label={dict.navSections}
      className="scrollbar-none overflow-x-auto border-b border-border bg-surface/70 lg:hidden"
    >
      {/* `w-max` is what makes this actually scroll. Without it the
          list resolves to the container's width, its pills overflow
          the list rather than the scroller, and the whole document
          grows sideways instead — 239px of it, once Memory Lane made
          this an eight-item row. */}
      <ul className="mx-auto flex w-max max-w-6xl gap-1.5 px-5 py-2.5">
        {ITEMS.map(({ href, labelKey, Icon }) => {
          const active = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[2.5rem] items-center gap-2 rounded-full px-3.5 py-2 text-base font-semibold whitespace-nowrap",
                  "transition-[background-color,color,box-shadow] duration-200 ease-gentle",
                  active
                    ? "bg-primary-soft text-primary shadow-soft"
                    : "text-text-muted hover:bg-surface-alt hover:text-text",
                )}
              >
                <Icon
                  className="size-4 shrink-0"
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
