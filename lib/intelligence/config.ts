/**
 * INTELLIGENCE — TUNABLE CONSTANTS
 * -----------------------------------------------------------------
 * Every threshold this layer uses, named and justified in one place,
 * exactly as Phase 2 does in lib/cognitive-performance/config.ts. None
 * of these is arbitrary; each carries the reasoning for its value, so
 * the whole personalisation can be read and argued with.
 *
 * Where Phase 2 already defines a number (history window, cold start,
 * consistency bands) this layer IMPORTS it rather than inventing a
 * second, contradictory value.
 */

import { DAY_MS } from "@/lib/reminders/timezone";

// -----------------------------------------------------------------
// Baseline
// -----------------------------------------------------------------

/**
 * A baseline needs more than one good or bad day. Three completed
 * sessions in a domain is the same floor Phase 2 uses before it will
 * personalise at all (COLD_START_MIN_SESSIONS), and keeping the two
 * aligned means a domain never has a baseline while Phase 2 still
 * considers it cold.
 */
export const BASELINE_MIN_SESSIONS = 3;

/** How many of the earliest sessions form the reference level. */
export const BASELINE_WINDOW = 5;

// -----------------------------------------------------------------
// Trend horizons
// -----------------------------------------------------------------

/** Medium horizon: "the last few weeks" against the few before. */
export const MEDIUM_WINDOW_DAYS = 21;
/** Long horizon: a season of activity against everything earlier. */
export const LONG_WINDOW_DAYS = 90;

/**
 * Minimum sessions in the recent window before a trend is stated at
 * all. Below this the answer is INSUFFICIENT_DATA — which is a real
 * answer, not a failure. Matches Phase 2's TREND_MIN_SESSIONS.
 */
export const TREND_MIN_WINDOW_SESSIONS = 3;

/**
 * How far the indicator must move between windows to call it a change.
 * Below this it is STABLE. Four points is roughly one harder round in a
 * five-round activity — smaller than that is noise, and telling a
 * family that noise is a "change" would be worse than saying nothing.
 */
export const TREND_DELTA_POINTS = 4;

/**
 * Consistency below this means results swing too much for a direction
 * to be meaningful, so the honest classification is VARIABLE rather
 * than a confident up or down. Sits just under Phase 2's
 * CONSISTENCY_SHAKY (50), so "shaky" and "too variable to call" agree.
 */
export const VARIABLE_CONSISTENCY_BELOW = 45;

// -----------------------------------------------------------------
// Confidence
// -----------------------------------------------------------------

/**
 * Activity older than this makes any reading stale: a person's recent
 * form three weeks ago says little about today, so confidence is
 * downgraded one level rather than presented as current.
 */
export const STALE_AFTER_DAYS = 21;

// -----------------------------------------------------------------
// Activity routine (NOT a health measure)
// -----------------------------------------------------------------

/** The window the "activity routine" figures describe. */
export const ROUTINE_WINDOW_DAYS = 14;

/** Days without activity before the tone becomes a gentle welcome back. */
export const RETURNING_AFTER_DAYS = 5;

// -----------------------------------------------------------------
// Recommendation weights
// -----------------------------------------------------------------

/**
 * The recommendation score is a small weighted sum, deliberately
 * transparent. Practice need leads, but never alone: without the
 * variety and recency terms a person would be handed their weakest
 * activity every single day, which is discouraging and (for this
 * audience especially) a good way to stop them opening the app.
 */
export const WEIGHT_NEEDS_PRACTICE = 40;
export const WEIGHT_NOT_PLAYED_RECENTLY = 25;
export const WEIGHT_VARIETY = 20;
export const WEIGHT_BUILD_ON_SUCCESS = 15;
export const WEIGHT_PREFERRED = 10;

/**
 * A domain never played at all is worth introducing, but it is NOT
 * "overdue" in the way a practised domain gone quiet is — and it must
 * not outrank a demonstrated weakness. So it gets its own, smaller
 * weight rather than the full recency bonus.
 */
export const WEIGHT_NEW_DOMAIN = 12;

/**
 * Practice need is judged RELATIVE to the person's own average across
 * the domains they actually play. "Weak" means weak *for them*: an
 * absolute scale barely separates a struggling 43 from the 55 neutral,
 * so a domain they had never opened could outrank the one they visibly
 * find hard.
 *
 * This is the number of indicator points below their own mean that
 * counts as fully weak. 25 is about one difficulty band.
 */
export const WEAKNESS_DEFICIT_POINTS = 25;

/**
 * A floor so a uniformly struggling person still gets practice weight:
 * if every domain is equally low there is no relative deficit, but they
 * plainly still need the practice. Measured below this level.
 */
export const WEAKNESS_ABSOLUTE_FROM = 60;
export const WEAKNESS_ABSOLUTE_MAX = 0.5;

/** Weakness assumed for a domain with no history — modest, not urgent. */
export const WEAKNESS_UNKNOWN_DOMAIN = 0.3;

/** Penalty for the activity played most recently, to break repetition. */
export const PENALTY_JUST_PLAYED = 35;
/** Penalty for a domain already covered in today's plan. */
export const PENALTY_DOMAIN_REPEAT = 30;

// -----------------------------------------------------------------
// Daily plan
// -----------------------------------------------------------------

/** A normal day's suggestion. Matches Phase 1's DAILY_GOAL of three. */
export const PLAN_SIZE_NORMAL = 3;
/** A lighter day, offered when recent sessions looked effortful. */
export const PLAN_SIZE_SHORT = 2;

/**
 * Effort signals. These describe how the ACTIVITY went — leaning on
 * hints, or a run of low scores — and at most make the next suggestion
 * gentler. They are never called fatigue, and never inferred from a
 * single session.
 */
export const EFFORT_MIN_SESSIONS = 3;
/** Hints per round above which recent play counts as effortful. */
export const EFFORT_HINT_RATE = 0.5;
/** Mean recent score below which recent play counts as effortful. */
export const EFFORT_SCORE_BELOW = 50;

// -----------------------------------------------------------------
// Data windows
// -----------------------------------------------------------------

/** How many completed sessions the longitudinal layer reads. */
export const INTELLIGENCE_HISTORY_LIMIT = 200;

export { DAY_MS };
