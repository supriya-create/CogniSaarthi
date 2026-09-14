"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  TriangleAlert,
} from "lucide-react";
import type { AlertSeverity, AlertStatus } from "@prisma/client";

import { Button } from "@/components/ui/Button";
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

const SEVERITY_META: Record<
  AlertSeverity,
  { Icon: typeof Circle; className: string; label: string }
> = {
  IMPORTANT: {
    Icon: TriangleAlert,
    className: "text-warning",
    label: "Important",
  },
  ATTENTION: { Icon: Circle, className: "text-secondary", label: "Attention" },
  INFO: { Icon: CheckCircle2, className: "text-success", label: "Info" },
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
      <h1 className="font-serif text-3xl font-semibold">Needs your attention</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/caregiver/alerts?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              filter === f.key
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-text-muted hover:bg-surface-alt",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {alerts.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center text-text-muted">
          Nothing here right now. That is usually good news.
        </p>
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
                  "rounded-2xl border bg-surface p-5 shadow-soft",
                  alert.status === "UNREAD"
                    ? "border-border-strong"
                    : "border-border",
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
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          "border-border bg-surface-alt text-text-muted",
                        )}
                      >
                        {meta.label}
                      </span>
                      {alert.status === "UNREAD" ? (
                        <span className="size-2 rounded-full bg-primary" aria-label="Unread" />
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

      <p className="mt-8 max-w-2xl text-sm leading-relaxed text-text-muted">
        These are gentle signals drawn from activity and reminders. They are
        not a medical measurement and never a diagnosis.
      </p>
    </div>
  );
}
