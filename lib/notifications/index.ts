/**
 * NOTIFICATION LAYER — public surface.
 *
 * A modular layer between reminder/alert data and delivery:
 *   types        — channels, payloads, alert descriptors
 *   builder      — reminder/alert copy (calm, non-medical)
 *   preferences  — pure "should this surface?" gates
 *   alerts       — pure derivation of caregiver alerts (signal, not noise)
 *   delivery     — the channel seam; only IN_APP is implemented
 *
 * Everything here is pure and unit-testable. The database-touching
 * sync that persists derived alerts lives in lib/reminders/alerts-sync
 * (server-only), so the layer itself never imports Prisma.
 */
export * from "@/lib/notifications/types";
export * from "@/lib/notifications/builder";
export * from "@/lib/notifications/preferences";
export * from "@/lib/notifications/alerts";
export * from "@/lib/notifications/delivery";
