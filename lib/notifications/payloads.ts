import type { Dict } from "@/lib/i18n/dictionaries";

/**
 * NOTIFICATIONS — what a notification is allowed to say (pure).
 * -----------------------------------------------------------------
 * A notification appears on a LOCK SCREEN. On a shared family tablet
 * — which is exactly what Cognisaarthi is built for — that surface is
 * readable by anyone in the room, and by anyone who picks the device
 * up, without unlocking it or signing in.
 *
 * So the rule here is absolute, and it is enforced by the type
 * signature rather than by remembering to be careful:
 *
 *     A notification carries a KIND. It never carries content.
 *
 * `buildSafeNotification` accepts a kind and a dictionary. There is no
 * parameter through which a reminder title, a medication name, a
 * memory description, a person's name, a photograph or a caregiver
 * note could be passed — so none of them can leak, and a future caller
 * cannot introduce the leak by accident.
 *
 * What the elder sees: "Your reminder is ready." They open the app —
 * behind their own session — and the actual content is there.
 *
 * This costs a little warmth. "Time for your morning medicine" is a
 * kinder sentence than "Your reminder is ready." It is also a sentence
 * that announces a person's medical routine to their neighbour, so it
 * is not one this product will send.
 */

/**
 * The kinds of notification this product can show.
 *
 * Each maps to exactly one destination. Adding a kind means adding a
 * destination, which is what keeps `notificationclick` total.
 */
export type SafeNotificationKind =
  | "REMINDER_DUE"
  | "DAILY_ACTIVITY"
  | "MEMORY_LANE_DUE";

/**
 * Where a click lands. Same-origin paths only — the service worker
 * re-checks this against its own copy of the allowlist rather than
 * trusting whatever a page asked it to display.
 */
export const NOTIFICATION_DESTINATION: Record<SafeNotificationKind, string> = {
  REMINDER_DUE: "/reminders",
  DAILY_ACTIVITY: "/home",
  MEMORY_LANE_DUE: "/memories/lane",
};

/**
 * The kinds anything in this phase actually emits.
 *
 * `MEMORY_LANE_DUE` is defined above and deliberately NOT here. Memory
 * Lane — the spaced-retrieval scheduler — is the next feature, and
 * `/memories/lane` is the route it will add. Nothing schedules or
 * shows this kind today, so no notification can send anybody to a page
 * that does not exist yet. The mapping is foundation, not a live path,
 * and a test asserts the distinction rather than leaving it to a
 * comment.
 */
export const EMITTED_NOTIFICATION_KINDS: SafeNotificationKind[] = [
  "REMINDER_DUE",
  "DAILY_ACTIVITY",
];

/** A notification that is safe to display on a locked device. */
export interface SafeNotification {
  kind: SafeNotificationKind;
  title: string;
  body: string;
  /** Where a click should go. */
  url: string;
  /**
   * Collapse key. A second reminder notification REPLACES the first
   * rather than stacking — waking up to eleven identical banners is
   * distressing, and for someone with memory difficulty it is worse
   * than useless because it gives no clue which one was acted on.
   */
  tag: string;
  icon: string;
  badge: string;
  /**
   * Always false. A notification that cannot be dismissed without
   * interacting is a trap for someone who is confused by it.
   */
  requireInteraction: boolean;
  /** Replacing a notification never re-alerts — it must not nag. */
  renotify: boolean;
  /** Always false: a silent notification cannot be the only signal. */
  silent: boolean;
}

/**
 * Build the notification for a kind.
 *
 * The only inputs are the kind and the language dictionary. That is
 * the whole privacy guarantee, expressed as a function signature.
 */
export function buildSafeNotification(
  kind: SafeNotificationKind,
  dict: Dict,
): SafeNotification {
  return {
    kind,
    title: dict.appName,
    body: bodyFor(kind, dict),
    url: NOTIFICATION_DESTINATION[kind],
    // One tag per kind: reminders collapse together, and an activity
    // nudge never overwrites a reminder.
    tag: `cogni-${kind.toLowerCase()}`,
    icon: "/icon.svg",
    badge: "/icon.svg",
    requireInteraction: false,
    renotify: false,
    silent: false,
  };
}

function bodyFor(kind: SafeNotificationKind, dict: Dict): string {
  switch (kind) {
    case "REMINDER_DUE":
      return dict.notifyReminderReady;
    case "DAILY_ACTIVITY":
      return dict.notifyActivityWaiting;
    case "MEMORY_LANE_DUE":
      return dict.notifyMemoryLaneReady;
  }
}

/**
 * Resolve a destination for a notification click.
 *
 * Returns null for anything unrecognised, so a malformed or tampered
 * notification payload opens nothing rather than navigating somewhere
 * arbitrary.
 */
export function destinationForKind(kind: string): string | null {
  if (!isSafeNotificationKind(kind)) return null;
  return NOTIFICATION_DESTINATION[kind];
}

export function isSafeNotificationKind(
  value: string,
): value is SafeNotificationKind {
  return Object.prototype.hasOwnProperty.call(
    NOTIFICATION_DESTINATION,
    value,
  );
}
