/**
 * NOTIFICATION LAYER — public surface.
 *
 * A modular layer between reminder/alert data and delivery:
 *   types        — channels, payloads, alert descriptors
 *   builder      — reminder/alert copy (calm, non-medical)
 *   preferences  — pure "should this surface?" gates
 *   alerts       — pure derivation of caregiver alerts (signal, not noise)
 *   delivery     — the channel seam
 *   capability   — pure: can this device notify, and what to do if not
 *   payloads     — pure: what a lock-screen notification may say
 *
 * Everything here is pure and unit-testable. The database-touching
 * sync that persists derived alerts lives in lib/reminders/alerts-sync
 * (server-only), so the layer itself never imports Prisma.
 *
 * `browser.ts` is deliberately NOT re-exported: it touches window and
 * navigator, and pulling it into this barrel would drag browser
 * globals into every server module that wants an alert type. Import it
 * directly from client code.
 */
export * from "@/lib/notifications/types";
export * from "@/lib/notifications/builder";
export * from "@/lib/notifications/preferences";
export * from "@/lib/notifications/alerts";
export * from "@/lib/notifications/delivery";
export * from "@/lib/notifications/capability";
export * from "@/lib/notifications/payloads";
