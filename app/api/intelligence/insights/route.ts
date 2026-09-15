import { NextResponse } from "next/server";

import { resolveIntelligenceTarget } from "@/lib/intelligence/access";
import { getIntelligenceSnapshot } from "@/lib/intelligence/server";
import { buildDeterministicInsight } from "@/lib/intelligence/explanations";
import { toDomainFeatureVector } from "@/lib/intelligence/features";
import { aiAvailability, generateInsight, toAiPayload } from "@/lib/intelligence/ai";

export const dynamic = "force-dynamic";

/**
 * One headline insight.
 *
 * The insight is COMPUTED deterministically first. Only then is the
 * optional AI layer offered a chance to rephrase it, using an
 * anonymised feature payload. With no provider configured — the case in
 * this repository — the deterministic text is returned unchanged and
 * `aiAvailability` says so honestly rather than implying a model was
 * involved.
 */
export async function GET() {
  const target = await resolveIntelligenceTarget();
  if (!target) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const snapshot = await getIntelligenceSnapshot(target.userId);
  const deterministic = buildDeterministicInsight(
    snapshot.profiles,
    snapshot.routine,
  );

  // Never sends anything identifying — see `toAiPayload`.
  const payload = toAiPayload(
    snapshot.profiles.map((profile) =>
      toDomainFeatureVector(profile, snapshot.routine),
    ),
    snapshot.routine.activitiesPerWeek,
    snapshot.routine.activeDays,
  );

  const { insight } = await generateInsight(payload, deterministic);

  return NextResponse.json(
    { insight, ai: aiAvailability() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
