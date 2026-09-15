import {
  Bell,
  CalendarHeart,
  Heart,
  House,
  LifeBuoy,
  ListChecks,
  Shapes,
  Sprout,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * The elder destinations, in one place so the bottom bar, the wide
 * navigation and the home screen cannot drift apart.
 *
 * `primary` marks the four that appear in the bottom bar on a phone.
 * Four is a deliberate ceiling: at the extra-large text setting a
 * fifth tab pushes the labels below a readable size, and an
 * unlabelled tab is the one thing this interface will not ship. The
 * rest are one tap away on the home screen, and all of them are
 * visible at once on a tablet or a laptop.
 */
export interface ElderNavItem {
  href: string;
  labelKey: keyof Dict;
  Icon: LucideIcon;
  primary?: boolean;
}

export const ELDER_NAV: ElderNavItem[] = [
  { href: "/home", labelKey: "home", Icon: House, primary: true },
  { href: "/games", labelKey: "navGames", Icon: Shapes, primary: true },
  { href: "/memories", labelKey: "navMemories", Icon: Heart, primary: true },
  {
    href: "/memories/lane",
    labelKey: "navMemoryLane",
    Icon: Sprout,
  },
  { href: "/routine", labelKey: "navRoutine", Icon: CalendarHeart },
  { href: "/reminders", labelKey: "navReminders", Icon: Bell },
  { href: "/history", labelKey: "navHistory", Icon: ListChecks },
  { href: "/help", labelKey: "sosTitle", Icon: LifeBuoy },
  { href: "/profile", labelKey: "navProfile", Icon: UserRound, primary: true },
];

/** Marks a destination current, including its sub-pages. */
export function isCurrent(pathname: string, href: string): boolean {
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}
