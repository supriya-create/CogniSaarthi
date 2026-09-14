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
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Caregiver section navigation. Denser than the elder nav — this is the
 * informative side of the product — but still labelled in words, never
 * bare icons.
 */

const ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/caregiver", label: "Overview", Icon: Home },
  { href: "/caregiver/reminders", label: "Reminders", Icon: Bell },
  { href: "/caregiver/alerts", label: "Alerts", Icon: BellRing },
  { href: "/caregiver/notes", label: "Notes", Icon: NotebookPen },
  { href: "/caregiver/summary", label: "Summary", Icon: TrendingUp },
  { href: "/caregiver/memories", label: "Memories", Icon: Images },
  { href: "/caregiver/settings", label: "Settings", Icon: Settings },
];

export function CaregiverNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Caregiver sections"
      className="border-b border-border bg-surface/70"
    >
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5 py-2">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            href === "/caregiver"
              ? pathname === "/caregiver"
              : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-text-muted hover:bg-surface-alt hover:text-text",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
