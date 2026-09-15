import { NextResponse } from "next/server";

import { resolveIntelligenceTarget } from "@/lib/intelligence/access";
import { getIntelligenceSnapshot } from "@/lib/intelligence/server";
import { explainTrend, trendClassLabel } from "@/lib/intelligence/explanations";
import { DOMAIN_LABEL } from "@/lib/intelligence/domains";

export const dynamic = "force-dynamic";

/**
 * The longitudinal picture, for whoever is signed in.
 *
 * Takes no parameters: an elder gets their own, a caregiver gets their
 * linked elder's, and there is no id to forge. Internal scoring is not
 * exposed wholesale — the response carries the figures a caregiver
 * screen actually renders plus the explanation, not the engine's
 * working.
 */
export async function GET() {
  const target = await resolveIntelligenceTarget();
  if (!target) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const snapshot = await getIntelligenceSnapshot(target.userId);

  return NextResponse.json(
    {
      routine: snapshot.routine,
      domains: snapshot.profiles.map((profile) => ({
        domain: profile.domain,
        label: DOMAIN_LABEL[profile.domain],
        trend: profile.trend.classification,
        trendLabel: trendClassLabel(profile.trend),
        previous: profile.trend.previous,
        current: profile.trend.current,
        confidence: profile.confidence,
        activityCount: profile.activityCount,
        baselineEstablished: profile.baseline.state === "ESTABLISHED",
        explanation: explainTrend(profile),
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
