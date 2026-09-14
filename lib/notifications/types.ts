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
  | "BROWSER_PUSH"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP";

/** The only channel actually implemented in Phase 4. */
export const IMPLEMENTED_CHANNELS: NotificationChannel[] = ["IN_APP"];

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
