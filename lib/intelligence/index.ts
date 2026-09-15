/**
 * ADVANCED COGNITIVE INTELLIGENCE — public surface.
 *
 * A longitudinal personalisation layer built ON TOP of the Phase 2
 * performance engine, never beside it. Phase 2 remains the single
 * authority on "how did that session go"; this layer answers the longer
 * questions — what is this person's baseline, which way are things
 * going over weeks, and what should they do next.
 *
 *   config        — every threshold, with its justification
 *   domains       — the four domains that actually have activities
 *   features      — the documented feature contract (reliability-labelled)
 *   baseline      — where someone started, refused until there is enough
 *   trends        — windowed comparisons, incl. VARIABLE / INSUFFICIENT
 *   confidence    — how much a reading deserves to be believed
 *   longitudinal  — per-domain profiles and the activity routine
 *   recommendations — balanced, explainable choice of what to do next
 *   daily-plan    — the day, which gets shorter when things are hard
 *   explanations  — the same decision told simply or in full
 *   safety        — the medical boundary, enforced in code
 *   ai            — optional rephrasing only; unavailable by default
 *
 * Everything here is pure and deterministic. The database-touching
 * adapter lives in `server.ts`.
 */
export * from "@/lib/intelligence/types";
export * from "@/lib/intelligence/config";
export * from "@/lib/intelligence/domains";
export * from "@/lib/intelligence/features";
export * from "@/lib/intelligence/baseline";
export * from "@/lib/intelligence/trends";
export * from "@/lib/intelligence/confidence";
export * from "@/lib/intelligence/longitudinal";
export * from "@/lib/intelligence/recommendations";
export * from "@/lib/intelligence/daily-plan";
export * from "@/lib/intelligence/explanations";
export * from "@/lib/intelligence/safety";
export * from "@/lib/intelligence/ai";
