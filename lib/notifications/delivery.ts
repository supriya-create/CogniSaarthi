import {
  IMPLEMENTED_CHANNELS,
  type DeliveryResult,
  type NotificationChannel,
  type NotificationPayload,
} from "@/lib/notifications/types";

/**
 * DELIVERY ABSTRACTION
 * -----------------------------------------------------------------
 * The one seam every future channel (web push, email, SMS, WhatsApp)
 * would slot into.
 *
 * Two channels exist. IN_APP is "delivered" simply by the record
 * existing for the UI to read, so there is nothing to transmit and it
 * always succeeds. BROWSER_LOCAL is shown by the device itself and is
 * therefore NOT deliverable from the server — this function runs on
 * both sides, and a server-side caller has no registration to show
 * anything through. It reports that plainly instead of guessing.
 *
 * Every other channel returns `delivered: false` with a clear reason.
 * This is deliberate honesty — Cognisaarthi sends no push, email or
 * SMS, and this function never pretends otherwise.
 */
export async function deliver(
  channel: NotificationChannel,
  payload: NotificationPayload,
): Promise<DeliveryResult> {
  if (!payload.title && !payload.body) {
    return { channel, delivered: false, reason: "empty_payload" };
  }
  if (channel === "IN_APP") {
    // The in-app surface reads the persisted reminder/alert directly,
    // so there is nothing to transmit — its existence is the delivery.
    return { channel, delivered: true };
  }
  if (channel === "BROWSER_LOCAL") {
    // Implemented, but only the device can perform it. The client path
    // is `showSafeNotification` in lib/notifications/browser.ts.
    return {
      channel,
      delivered: false,
      reason: "client_side_channel",
    };
  }
  return {
    channel,
    delivered: false,
    reason: "channel_not_configured",
  };
}

/** True when a channel is actually wired up. */
export function isChannelAvailable(channel: NotificationChannel): boolean {
  return IMPLEMENTED_CHANNELS.includes(channel);
}
