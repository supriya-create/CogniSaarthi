import type { Dict } from "@/lib/i18n/dictionaries";
import { DOMAIN_LABEL } from "@/lib/intelligence/domains";
import type {
  ActivityRecommendation,
  ActivityRoutine,
  Insight,
  LongitudinalDomainProfile,
  RecommendationReasonCode,
  TrendReading,
} from "@/lib/intelligence/types";

/**
 * EXPLANATIONS (pure, deterministic)
 * -----------------------------------------------------------------
 * The same decision, told two ways.
 *
 * The ELDER gets one short, warm line and never sees the machinery —
 * no levels, no scores, no reasoning. "Let's try a memory activity
 * today" is the whole of it, in their own language.
 *
 * The CAREGIVER gets the actual reasoning, in plain English, because
 * the promise this product makes is that personalisation can always be
 * explained. But it stays on the right side of the line: it describes
 * how the ACTIVITIES went, never the person's health.
 *
 * Everything here is deterministic. The optional AI layer only ever
 * rephrases these; if it is absent or misbehaves, this is what ships.
 */

// -----------------------------------------------------------------
// Elder-facing (localised, one line, no numbers)
// -----------------------------------------------------------------

const ELDER_REASON_KEY: Record<RecommendationReasonCode, keyof Dict> = {
  needsPractice: "journeyReasonNeedsPractice",
  buildOnSuccess: "journeyReasonKeepSteady",
  keepSteady: "journeyReasonKeepSteady",
  forVariety: "journeyReasonForEnjoyment",
  preferred: "journeyReasonForEnjoyment",
  notPlayedRecently: "journeyReasonForEnjoyment",
  gentleReturn: "journeyReasonForEnjoyment",
  coldStart: "journeyReasonForEnjoyment",
};

/** The short phrase shown under an activity on the elder's home. */
export function elderReasonFor(
  recommendation: ActivityRecommendation,
  dict: Dict,
): string {
  return dict[ELDER_REASON_KEY[recommendation.primaryReason]];
}

// -----------------------------------------------------------------
// Caregiver-facing (English, explains the actual decision)
// -----------------------------------------------------------------

const CAREGIVER_REASON: Record<RecommendationReasonCode, string> = {
  needsPractice:
    "these activities have been less consistent recently, so a little more practice may help",
  buildOnSuccess:
    "recent sessions in this area have been going well, so it starts the day on something encouraging",
  keepSteady: "this area is steady, so it keeps the routine balanced",
  forVariety: "it has not come up lately, which keeps the day varied",
  preferred: "it is one of the activities they do most often",
  notPlayedRecently: "this area has not been practised for a few days",
  gentleReturn:
    "they have not done an activity for a while, so today starts gently",
  coldStart:
    "there is not enough history yet, so activities start at a comfortable level while Cognisaarthi learns how they go",
};

/** One sentence explaining why an activity was suggested. */
export function explainRecommendationForCaregiver(
  recommendation: ActivityRecommendation,
  gameName: string,
): string {
  const reasons = recommendation.reasons.slice(0, 2);
  const parts = reasons.length > 0
    ? reasons.map((code) => CAREGIVER_REASON[code])
    : [CAREGIVER_REASON[recommendation.primaryReason]];

  return `${gameName} was suggested because ${parts.join(", and ")}.`;
}

// -----------------------------------------------------------------
// Trends
// -----------------------------------------------------------------

/** Caregiver-facing label. Describes activity, never a faculty. */
export function trendClassLabel(reading: TrendReading): string {
  switch (reading.classification) {
    case "IMPROVING":
      return "Improving";
    case "DECLINING":
      return "More challenging lately";
    case "VARIABLE":
      return "Varied";
    case "STABLE":
      return "Steady";
    case "INSUFFICIENT_DATA":
    default:
      return "Not enough activity yet";
  }
}

/**
 * The sentence under a trend. When there is too little to go on it says
 * exactly that, rather than dressing up a guess.
 */
export function explainTrend(
  profile: LongitudinalDomainProfile,
): string {
  const label = DOMAIN_LABEL[profile.domain];
  const reading = profile.trend;
  const count = reading.sessionCount;

  if (reading.classification === "INSUFFICIENT_DATA") {
    return `Not enough recent activity to identify a trend for ${label.toLowerCase()} activities.`;
  }

  if (reading.confidence === "LOW") {
    return `Based on only ${count} recent ${plural(count, "activity", "activities")}, so this is an early impression rather than a pattern.`;
  }

  const basis = `Based on ${count} recent ${plural(count, "activity", "activities")}.`;

  switch (reading.classification) {
    case "IMPROVING":
      return `${basis} Performance in these activities has improved compared with the previous period.`;
    case "DECLINING":
      return `${basis} These activities have been a little harder than in the previous period. This describes how the activities went, not a health measurement.`;
    case "VARIABLE":
      return `${basis} Results have varied quite a bit, so no clear direction can be read from them yet.`;
    case "STABLE":
    default:
      return `${basis} Performance has stayed about the same as the previous period.`;
  }
}

// -----------------------------------------------------------------
// Activity routine (never a health score)
// -----------------------------------------------------------------

export function explainRoutine(routine: ActivityRoutine): string {
  if (routine.totalActivities === 0) {
    return "No activities have been completed yet.";
  }
  if (routine.activeDays === 0) {
    return `No activities in the last ${routine.daysInWindow} days.`;
  }
  return `Active on ${routine.activeDays} of the last ${routine.daysInWindow} days, averaging ${routine.activitiesPerWeek} ${plural(routine.activitiesPerWeek, "activity", "activities")} a week.`;
}

// -----------------------------------------------------------------
// Elder progress (warm, non-medical, no scores)
// -----------------------------------------------------------------

export type ElderProgressKey =
  | "progressBuildingRoutine"
  | "progressWeekCount"
  | "progressWelcomeBack"
  | "progressFirstSteps";

/**
 * Which encouraging line to show the elder. Returns a KEY so the
 * wording stays in the dictionaries and works in all three languages.
 */
export function elderProgressKey(routine: ActivityRoutine): ElderProgressKey {
  if (routine.totalActivities === 0) return "progressFirstSteps";
  if (
    routine.daysSinceLastActivity !== null &&
    routine.daysSinceLastActivity >= 5
  ) {
    return "progressWelcomeBack";
  }
  if (routine.activeDays >= 3) return "progressBuildingRoutine";
  return "progressWeekCount";
}

// -----------------------------------------------------------------
// A single headline insight
// -----------------------------------------------------------------

/**
 * The one thing most worth saying right now, built deterministically.
 *
 * This is what ships: the optional AI layer may only ever REPHRASE this
 * object, never compute it. If no provider is configured — which is the
 * case in this repository — this is exactly what the caregiver reads.
 *
 * It leads with a reportable trend if there is one, then falls back to
 * the routine, then to an honest "not enough yet".
 */
export function buildDeterministicInsight(
  profiles: LongitudinalDomainProfile[],
  routine: ActivityRoutine,
): Insight {
  // Prefer a domain with a direction worth mentioning, strongest first.
  const reportable = profiles
    .filter(
      (p) =>
        p.trend.classification !== "INSUFFICIENT_DATA" &&
        p.confidence !== "LOW",
    )
    .sort((a, b) => Math.abs(b.trend.delta ?? 0) - Math.abs(a.trend.delta ?? 0));

  const headline = reportable[0];

  if (headline) {
    return {
      title: `${DOMAIN_LABEL[headline.domain]} activities — ${trendClassLabel(headline.trend).toLowerCase()}`,
      explanation: explainTrend(headline),
      suggestion:
        headline.trend.classification === "DECLINING"
          ? `A little more practice with ${DOMAIN_LABEL[headline.domain].toLowerCase()} activities may help. Cognisaarthi has already eased the level.`
          : `Keeping the current routine going should maintain this.`,
      confidence: headline.confidence,
      source: "DETERMINISTIC",
    };
  }

  if (routine.totalActivities === 0) {
    return {
      title: "No activities yet",
      explanation:
        "Nothing has been completed yet, so there is nothing to summarise.",
      suggestion: "A first short activity will start building a picture.",
      confidence: "LOW",
      source: "DETERMINISTIC",
    };
  }

  return {
    title: "Building a picture",
    explanation: `${explainRoutine(routine)} There is not yet enough activity in any one area to describe a trend.`,
    suggestion:
      "A few more activities across the week will let Cognisaarthi personalise more confidently.",
    confidence: "LOW",
    source: "DETERMINISTIC",
  };
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
