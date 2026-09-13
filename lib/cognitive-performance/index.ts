/**
 * COGNITIVE PERFORMANCE ENGINE — public surface.
 *
 * The pieces:
 *   config          — every tunable number, named and commented
 *   metrics         — pure maths (mean, stdev, trend, indicator …)
 *   performance     — history → a domain's performance picture
 *   difficulty      — performance → the next level (the adaptive rule)
 *   recommendations — performance → daily plan + human-readable copy
 *
 * Everything here is a pure function over `PerformanceSample[]`. The
 * database lives behind `profile.ts`, which is the only part that
 * touches Prisma, so the engine itself is fully unit-testable.
 */

export * from "@/lib/cognitive-performance/types";
export * from "@/lib/cognitive-performance/config";
export * from "@/lib/cognitive-performance/metrics";
export * from "@/lib/cognitive-performance/performance";
export * from "@/lib/cognitive-performance/difficulty";
export * from "@/lib/cognitive-performance/recommendations";
