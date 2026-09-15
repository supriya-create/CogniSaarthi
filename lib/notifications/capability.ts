/**
 * NOTIFICATIONS — capability assessment (pure).
 * -----------------------------------------------------------------
 * Whether this device can show a notification at all is a question
 * with four different answers, and they need four different responses
 * in the interface. Conflating them produces the worst possible
 * outcome for an elderly user: a switch that turns on, says nothing,
 * and silently never notifies anybody.
 *
 * So the assessment is a pure function over a described environment,
 * not a tangle of `typeof window !== "undefined"` checks inline in a
 * component. The browser globals are read once, in `browser.ts`; this
 * module decides what they mean and is fully unit-testable.
 *
 * What this layer does NOT do is claim to work when the browser is
 * closed. See `payloads.ts` and `lib/notifications/delivery.ts` — a
 * locally-shown notification and a server-sent push are different
 * capabilities, and only the first one exists here.
 */

/** Why notifications are impossible, when they are. */
export type UnsupportedReason =
  /** Served over plain http, where the APIs are withheld entirely. */
  | "INSECURE_CONTEXT"
  /** No `Notification` constructor — an old or stripped-down browser. */
  | "NO_NOTIFICATION_API"
  /** No service worker, so nothing can display or route a click. */
  | "NO_SERVICE_WORKER";

/** The browser's own permission value. */
export type NotificationPermissionValue = "granted" | "denied" | "default";

/**
 * A described browser environment. Everything the decision depends on,
 * as plain data — which is what makes the rule testable.
 */
export interface NotificationEnvironment {
  isSecureContext: boolean;
  hasNotificationApi: boolean;
  hasServiceWorker: boolean;
  /** Null when the API is absent and there is no value to read. */
  permission: NotificationPermissionValue | null;
}

/**
 * What the interface should do about notifications right now.
 *
 * `DENIED` is deliberately separate from `NEEDS_PERMISSION`: once a
 * browser is denied, asking again does nothing (the prompt never
 * appears), so offering a button that looks like it will help is a
 * small lie. The denied state gets an explanation instead.
 */
export type NotificationReadiness =
  | { state: "UNSUPPORTED"; reason: UnsupportedReason }
  | { state: "DENIED" }
  | { state: "NEEDS_PERMISSION" }
  | { state: "READY" };

/**
 * Decide what this environment can do.
 *
 * Order matters. An insecure context is checked FIRST because it is
 * the root cause that makes the other two look broken: on plain http
 * `serviceWorker` is simply absent, and reporting "your browser has no
 * service worker" would send someone chasing the wrong problem.
 */
export function assessNotifications(
  env: NotificationEnvironment,
): NotificationReadiness {
  if (!env.isSecureContext) {
    return { state: "UNSUPPORTED", reason: "INSECURE_CONTEXT" };
  }
  if (!env.hasNotificationApi) {
    return { state: "UNSUPPORTED", reason: "NO_NOTIFICATION_API" };
  }
  // Notifications are shown THROUGH the worker so a click can be routed
  // even with no page open. Without one there is no delivery path.
  if (!env.hasServiceWorker) {
    return { state: "UNSUPPORTED", reason: "NO_SERVICE_WORKER" };
  }
  if (env.permission === "denied") return { state: "DENIED" };
  if (env.permission === "granted") return { state: "READY" };
  return { state: "NEEDS_PERMISSION" };
}

/** True only when a notification would actually appear. */
export function canShowNotifications(
  readiness: NotificationReadiness,
): boolean {
  return readiness.state === "READY";
}

/**
 * True only when asking would actually produce a prompt.
 *
 * Used to decide whether to render the "Turn on" button at all, so the
 * interface never offers an action that cannot succeed.
 */
export function canAskForPermission(
  readiness: NotificationReadiness,
): boolean {
  return readiness.state === "NEEDS_PERMISSION";
}
