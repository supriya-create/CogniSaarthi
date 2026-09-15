"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { BellOff, CheckCircle2, Circle, TriangleAlert } from "lucide-react";
import type { AlertSeverity, AlertStatus } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils/cn";

/**
 * The caregiver alert center. Meaningful signals, not a notification
 * stream. Filters help find what needs attention; resolving or
 * dismissing keeps the record (nothing important is deleted).
 */

export interface AlertDTO {
  id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  status: AlertStatus;
  when: string;
}

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "important", label: "Important" },
  { key: "resolved", label: "Resolved" },
];

/**
 * Severity carries a distinct icon SHAPE as well as a colour and a
 * word — a triangle, a ring, a tick — so the hierarchy survives a
 * greyscale screen or a colour-blind reader.
 */
const SEVERITY_META: Record<
  AlertSeverity,
  {
    Icon: typeof Circle;
    className: string;
    label: string;
    edge: string;
    tone: string;
  }
> = {
  IMPORTANT: {
    Icon: TriangleAlert,
    className: "text-warning",
    label: "Important",
    edge: "border-l-warning",
    tone: "border-warning/30 bg-warning-soft text-warning",
  },
  ATTENTION: {
    Icon: Circle,
    className: "text-secondary",
    label: "Attention",
    edge: "border-l-secondary",
    tone: "border-secondary/25 bg-secondary-soft text-secondary",
  },
  INFO: {
    Icon: CheckCircle2,
    className: "text-success",
    label: "Info",
    edge: "border-l-success",
    tone: "border-success/25 bg-success-soft text-success",
  },
};

export function AlertCenter({
  alerts,
  filter,
}: {
  alerts: AlertDTO[];
  filter: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "read" | "resolve" | "dismiss") {
    setBusy(id);
    await fetch(`/api/caregiver/alerts/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
        Needs your attention
      </h1>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/caregiver/alerts?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[2.5rem] items-center rounded-full border px-4 py-1.5 text-base font-semibold",
              "transition-[background-color,color,box-shadow] duration-200 ease-gentle",
              filter === f.key
                ? "border-primary/30 bg-primary-soft text-primary shadow-soft"
                : "border-border bg-surface text-text-muted hover:bg-surface-alt hover:text-text",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {alerts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Nothing here right now."
            body="That is usually good news."
            icon={<BellOff className="size-10" aria-hidden />}
          />
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {alerts.map((alert) => {
            const meta = SEVERITY_META[alert.severity];
            const resolved =
              alert.status === "RESOLVED" || alert.status === "DISMISSED";
            return (
              <li
                key={alert.id}
                className={cn(
                  "rounded-2xl border border-l-4 bg-surface p-5 shadow-soft",
                  meta.edge,
                  alert.status === "UNREAD"
                    ? "border-y-border-strong border-r-border-strong"
                    : "border-y-border border-r-border",
                  resolved && "opacity-70",
                )}
              >
                <div className="flex items-start gap-3">
                  <meta.Icon
                    className={cn("mt-0.5 size-6 shrink-0", meta.className)}
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold">
                        {alert.title}
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-sm font-semibold",
                          meta.tone,
                        )}
                      >
                        {meta.label}
                      </span>
                      {alert.status === "UNREAD" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-soft px-2.5 py-0.5 text-sm font-semibold text-primary">
                          <span aria-hidden className="size-2 rounded-full bg-primary" />
                          Unread
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-base text-text-muted">
                      {alert.body}
                    </span>
                    <span className="mt-1 text-sm text-text-muted">
                      {alert.when}
                      {resolved ? " · Resolved" : ""}
                    </span>
                  </div>
                </div>

                {!resolved ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {alert.status === "UNREAD" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => act(alert.id, "read")}
                        disabled={busy === alert.id}
                      >
                        Mark read
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => act(alert.id, "resolve")}
                      disabled={busy === alert.id}
                    >
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => act(alert.id, "dismiss")}
                      disabled={busy === alert.id}
                    >
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 rounded-2xl border border-border bg-surface-alt/60 px-5 py-4 text-base leading-relaxed text-text-muted">
        These are gentle signals drawn from activity and reminders. They are
        not a medical measurement and never a diagnosis.
      </p>
    </div>
  );
}
