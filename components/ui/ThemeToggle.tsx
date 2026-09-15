"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { THEME_STORAGE_KEY, type ThemeChoice } from "@/components/ui/ThemeScript";
import { cn } from "@/lib/utils/cn";

/**
 * A three-way segmented control: follow the device, or force light or
 * dark. Each option carries a word as well as an icon, and the chosen
 * one is marked by `aria-checked` rather than by colour alone.
 *
 * The choice lives on the device, not in React state, so it is read
 * with `useSyncExternalStore`: the server snapshot is always "system"
 * and the client snapshot is whatever this device saved. React
 * reconciles the two without a hydration mismatch, and without a
 * setState inside an effect.
 */

const OPTIONS: { value: ThemeChoice; Icon: LucideIcon }[] = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
];

const CHANGE_EVENT = "cognisaarthi:themechange";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` covers the same account open in another tab.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    // Private mode — fall back to following the device.
    return "system";
  }
}

const getServerSnapshot = (): ThemeChoice => "system";

function choose(next: ThemeChoice) {
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);

  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // The choice still applies for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ThemeToggle({
  labels,
}: {
  labels: Record<ThemeChoice, string>;
}) {
  const choice = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return (
    <div
      role="radiogroup"
      aria-label={labels.system}
      className="inline-flex w-full gap-1 rounded-2xl border border-border bg-surface-alt p-1"
    >
      {OPTIONS.map(({ value, Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(value)}
            className={cn(
              "flex min-h-[2.75rem] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2 text-base font-semibold",
              "transition-[background-color,color,box-shadow] duration-200 ease-gentle",
              active
                ? "bg-surface text-text shadow-soft"
                : "text-text-muted hover:text-text",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {labels[value]}
          </button>
        );
      })}
    </div>
  );
}
