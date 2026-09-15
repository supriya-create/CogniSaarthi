import { NextResponse } from "next/server";

import { resolveIntelligenceTarget } from "@/lib/intelligence/access";
import { getDailyPlan } from "@/lib/intelligence/server";

export const dynamic = "force-dynamic";

/**
 * Today's personalised plan. Identity comes from the session; there is
 * no user id to supply or to forge.
 *
 * The response carries what a client needs to RENDER the plan — which
 * activities, at which level, and the reason CODE. It deliberately does
 * not include the engine's scores: the elder must never see them, and
 * nothing downstream needs them.
 */
export async function GET() {
  const target = await resolveIntelligenceTarget();
  if (!target) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const plan = await getDailyPlan(target.userId);

  return NextResponse.json(
    {
      shape: plan.shape,
      gentler: plan.gentler,
      complete: plan.complete,
      completedToday: plan.completedToday,
      activities: plan.activities.map((activity) => ({
        gameId: activity.gameId,
        domain: activity.domain,
        difficulty: activity.difficulty,
        estimatedMinutes: activity.estimatedMinutes,
        reason: activity.primaryReason,
      })),
      optionalExtra: plan.optionalExtra
        ? {
            gameId: plan.optionalExtra.gameId,
            domain: plan.optionalExtra.domain,
            difficulty: plan.optionalExtra.difficulty,
          }
        : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
