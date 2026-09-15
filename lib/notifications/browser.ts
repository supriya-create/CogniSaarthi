import {
  assessNotifications,
  type NotificationEnvironment,
  type NotificationPermissionValue,
  type NotificationReadiness,
} from "@/lib/notifications/capability";
import {
  buildSafeNotification,
  type SafeNotification,
  type SafeNotificationKind,
} from "@/lib/notifications/payloads";
import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * NOTIFICATIONS — the browser edge.
 * -----------------------------------------------------------------
 * The ONLY module that touches `Notification`, `navigator` or the
 * service worker registration. Everything it decides is delegated to
 * the pure functions in `capability.ts` and `payloads.ts`, so this
 * file stays thin enough to read in one go and the logic stays
 * testable without a browser.
 *
 * Nothing here ever throws. Every failure path returns a described
 * result, because the caller is an interface shown to an elderly
 * person: a rejected promise would surface as a blank switch or a
 * console error nobody reads, and the one outcome this must never
 * produce is a control that looks enabled and does nothing.
 */

/** Read the live browser environment. Safe to call during SSR. */
export function readEnvironment(): NotificationEnvironment {
  if (typeof window === "undefined") {
    // Server render: claim nothing. The client re-assesses on mount.
    return {
      isSecureContext: false,
      hasNotificationApi: false,
      hasServiceWorker: false,
      permission: null,
    };
  }

  const hasNotificationApi = "Notification" in window;

  return {
    isSecureContext: window.isSecureContext === true,
    hasNotificationApi,
    hasServiceWorker:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
    permission: hasNotificationApi
      ? (Notification.permission as NotificationPermissionValue)
      : null,
  };
}

/** What this device can do about notifications right now. */
export function notificationReadiness(): NotificationReadiness {
  return assessNotifications(readEnvironment());
}

/**
 * Ask the browser for permission.
 *
 * Called ONLY from an explicit control the person pressed — never on
 * page load. An unprompted permission dialog is confusing for anyone
 * and genuinely alarming for someone with memory difficulty, and a
 * browser that sees one will often deny it permanently on their
 * behalf, which would cost us the capability for good.
 */
export async function requestNotificationPermission(): Promise<NotificationReadiness> {
  const readiness = notificationReadiness();

  // Nothing to ask for: already granted, already denied, or the API is
  // not there to ask. Report the state rather than attempting a call.
  if (readiness.state !== "NEEDS_PERMISSION") return readiness;

  try {
    const result = await Notification.requestPermission();
    return assessNotifications({
      ...readEnvironment(),
      permission: result as NotificationPermissionValue,
    });
  } catch {
    // Some browsers reject rather than resolve "denied". Treat a
    // failed ask as a refusal; re-reading permission confirms it.
    return assessNotifications(readEnvironment());
  }
}

/** Why a notification did not appear. Never thrown, always returned. */
export type ShowFailure =
  | "not_ready"
  | "no_service_worker"
  | "show_failed";

export type ShowResult =
  | { shown: true }
  | { shown: false; reason: ShowFailure };

/**
 * Display a notification through the service worker.
 *
 * `registration.showNotification` rather than `new Notification(...)`
 * for two reasons: the constructor is unavailable on Android Chrome
 * entirely, and only the worker's version survives the page being
 * closed — which is the whole point. A reminder that requires the app
 * to already be open is not a reminder.
 */
export async function showSafeNotification(
  notification: SafeNotification,
): Promise<ShowResult> {
  const readiness = notificationReadiness();
  if (readiness.state !== "READY") return { shown: false, reason: "not_ready" };

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration) return { shown: false, reason: "no_service_worker" };

    await registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.tag,
      icon: notification.icon,
      badge: notification.badge,
      requireInteraction: notification.requireInteraction,
      silent: notification.silent,
      // Read back by the worker's `notificationclick` handler, which
      // re-validates the kind against its own allowlist before opening
      // anything. Carries a kind, never any content.
      data: { kind: notification.kind },
      // `renotify` is not in every lib.dom version; it is valid and
      // ignored where unsupported.
      ...({ renotify: notification.renotify } as Record<string, unknown>),
    });

    return { shown: true };
  } catch {
    return { shown: false, reason: "show_failed" };
  }
}

/** Convenience: build for a kind and show it. */
export async function notify(
  kind: SafeNotificationKind,
  dict: Dict,
): Promise<ShowResult> {
  return showSafeNotification(buildSafeNotification(kind, dict));
}
