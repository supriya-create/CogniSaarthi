import type { AlertSeverity, AlertType } from "@prisma/client";

/**
 * NOTIFICATION LAYER — shared types.
 * -----------------------------------------------------------------
 * A modular layer sitting between the reminder/alert data and however
 * a message eventually reaches someone. Phase 4 delivers IN-APP only —
 * the reminder and alert rows the UI reads ARE the delivery. The other
 * channels are declared so the seam exists for a later phase; they are
 * never claimed to work, and `deliver()` returns them as unconfigured.
 */

export type NotificationChannel =
  | "IN_APP"
  /**
   * A notification the DEVICE shows itself, through the service worker
   * registration. Needs no server, no key and no vendor.
   *
   * Deliberately distinct from BROWSER_PUSH below, and the distinction
   * is not pedantry: this channel can only fire while the app has a
   * live client or the worker is awake. It reaches somebody who has
   * the tablet in front of them with the app in a background tab; it
   * does not reach somebody whose browser is fully closed.
   */
  | "BROWSER_LOCAL"
  /**
   * Server-initiated Web Push — the one that wakes a closed browser.
   * Needs VAPID keys and a push service, neither of which exists here,
   * so it stays unconfigured rather than being quietly conflated with
   * BROWSER_LOCAL.
   */
  | "BROWSER_PUSH"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP";

/**
 * The channels actually implemented.
 *
 * IN_APP: the persisted row the interface reads.
 * BROWSER_LOCAL: shown by this device via the service worker, subject
 * to permission and browser support — see lib/notifications/capability.
 */
export const IMPLEMENTED_CHANNELS: NotificationChannel[] = [
  "IN_APP",
  "BROWSER_LOCAL",
];

export interface NotificationPayload {
  title: string;
  body: string;
}

export interface DeliveryResult {
  channel: NotificationChannel;
  delivered: boolean;
  /** Present when not delivered, e.g. "channel_not_configured". */
  reason?: string;
}

/** A neutral, non-medical alert ready to be persisted. */
export interface AlertDescriptor {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  body: string;
  /** Stable identity so one condition is one alert, not a stream. */
  dedupeKey: string;
}
