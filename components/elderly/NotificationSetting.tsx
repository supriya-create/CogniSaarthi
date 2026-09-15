"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Info, TriangleAlert } from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { SettingsGroup, SettingsRow } from "@/components/ui/Settings";
import { getDict } from "@/lib/i18n/dictionaries";
import {
  notificationReadiness,
  notify,
  requestNotificationPermission,
} from "@/lib/notifications/browser";
import type { NotificationReadiness } from "@/lib/notifications/capability";

/**
 * Turning on alerts for this device.
 *
 * Three rules shape this control, and all three are about not lying to
 * somebody who will not be able to tell:
 *
 *  1. **Never ask on load.** The browser prompt only appears after a
 *     deliberate press. An unrequested permission dialog is alarming,
 *     and a browser that sees one often denies it permanently on the
 *     person's behalf — which costs the capability for good.
 *
 *  2. **Never show a switch that cannot work.** If the browser has no
 *     Notification API, or the page is not on https, or permission was
 *     already refused, the control is replaced by a sentence saying so.
 *     A switch that flips on and never notifies anybody is the worst
 *     outcome available here.
 *
 *  3. **Say what it cannot do.** These notifications come from this
 *     device, so they arrive while the app is open or recently used.
 *     They do not reach a closed browser — that needs Web Push, which
 *     this product does not have. The limitation is printed on the
 *     screen rather than left for somebody to discover by missing a
 *     reminder.
 */
export function NotificationSetting({ language }: { language: Language }) {
  const dict = getDict(language);

  // Starts UNSUPPORTED so the server render claims nothing; the real
  // assessment needs browser globals and happens on mount.
  const [readiness, setReadiness] = useState<NotificationReadiness>({
    state: "UNSUPPORTED",
    reason: "NO_NOTIFICATION_API",
  });
  const [checked, setChecked] = useState(false);
  const [asking, setAsking] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "sent" | "failed">(
    "idle",
  );

  useEffect(() => {
    setChecked(true);
    setReadiness(notificationReadiness());
  }, []);

  // Before the effect runs we know nothing about this browser, so show
  // nothing rather than a wrong answer.
  if (!checked) return null;

  async function handleEnable() {
    setAsking(true);
    try {
      setReadiness(await requestNotificationPermission());
    } finally {
      setAsking(false);
    }
  }

  async function handleTest() {
    // A real notification through the real path — if this appears, the
    // whole chain works on this device. Uses the generic activity copy,
    // which carries no content of any kind.
    const result = await notify("DAILY_ACTIVITY", dict);
    setTestResult(result.shown ? "sent" : "failed");
  }

  return (
    <SettingsGroup
      icon={<BellRing className="size-6" aria-hidden />}
      title={dict.notifyTitle}
      description={dict.notifyHelp}
    >
      <SettingsRow control={<Body />} />
    </SettingsGroup>
  );

  function Body() {
    if (readiness.state === "UNSUPPORTED") {
      return (
        <Notice
          tone="muted"
          icon={<Info className="size-5" aria-hidden />}
          text={
            readiness.reason === "INSECURE_CONTEXT"
              ? dict.notifyUnsupportedInsecure
              : dict.notifyUnsupportedBrowser
          }
        />
      );
    }

    if (readiness.state === "DENIED") {
      // No "Turn on" button: pressing it would open no prompt and do
      // nothing. The way back is through browser settings, so say that.
      return (
        <Notice
          tone="warn"
          icon={<TriangleAlert className="size-5" aria-hidden />}
          text={dict.notifyDenied}
        />
      );
    }

    if (readiness.state === "NEEDS_PERMISSION") {
      return (
        <div className="space-y-4">
          <Button onClick={handleEnable} disabled={asking} fullWidth>
            {asking ? dict.notifyAsking : dict.notifyEnable}
          </Button>
          <Limitation text={dict.notifyOnlyWhenOpen} />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2.5 text-lg font-semibold text-success">
          <Check className="size-6 shrink-0" aria-hidden />
          {dict.notifyEnabled}
        </p>

        <Button onClick={handleTest} variant="outline" fullWidth>
          {dict.notifyTest}
        </Button>

        {testResult !== "idle" ? (
          <p
            role="status"
            className="text-base leading-snug text-text-muted"
          >
            {testResult === "sent"
              ? dict.notifyTestSent
              : dict.notifyTestFailed}
          </p>
        ) : null}

        <Limitation text={dict.notifyOnlyWhenOpen} />
      </div>
    );
  }
}

/** The honest small print about what these alerts cannot do. */
function Limitation({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2.5 text-base leading-snug text-text-muted">
      <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

function Notice({
  tone,
  icon,
  text,
}: {
  tone: "muted" | "warn";
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <p
      className={
        tone === "warn"
          ? "flex items-start gap-2.5 text-base leading-snug text-warning"
          : "flex items-start gap-2.5 text-base leading-snug text-text-muted"
      }
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </p>
  );
}
