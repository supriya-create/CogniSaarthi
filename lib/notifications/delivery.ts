import {
  IMPLEMENTED_CHANNELS,
  type DeliveryResult,
  type NotificationChannel,
  type NotificationPayload,
} from "@/lib/notifications/types";

/**
 * DELIVERY ABSTRACTION
 * -----------------------------------------------------------------
 * The one seam every future channel (browser push, email, SMS,
 * WhatsApp) would slot into. Today only IN_APP exists: an in-app
 * notification is "delivered" simply by the record existing for the UI
 * to read, so there is nothing to send and it always succeeds.
 *
 * Every other channel returns `delivered: false` with a clear reason.
 * This is deliberate honesty — Cognisaarthi does not send push, email
 * or SMS in Phase 4, and this function never pretends otherwise.
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
  return {
    channel,
    delivered: false,
    reason: "channel_not_configured",
  };
}

/** True when a channel is actually wired up (only IN_APP in Phase 4). */
export function isChannelAvailable(channel: NotificationChannel): boolean {
  return IMPLEMENTED_CHANNELS.includes(channel);
}
