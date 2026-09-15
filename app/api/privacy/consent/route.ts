import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  declineConsent,
  getConsentStatus,
  grantConsent,
  withdrawConsent,
} from "@/lib/privacy/server";
import { researchConsentSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Research consent — the elder's own decision, and only theirs.
 *
 * Both handlers read identity from the ELDER cookie. There is no
 * caregiver path into this route, and no `userId` in the schema, so a
 * caregiver signed in on the same device cannot answer on someone
 * else's behalf — not through a body, not through a query string.
 *
 * That is the deliberate position described in §9 of the Phase 7 notes:
 * a caregiver link is a care relationship, and Cognisaarthi has no way
 * to establish legal authority to consent for another adult. Rather
 * than approximating it, the capability does not exist.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  return NextResponse.json(await getConsentStatus(user.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = researchConsentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { action } = parsed.data;

  const status =
    action === "GRANT"
      ? await grantConsent(user.id)
      : action === "DECLINE"
        ? await declineConsent(user.id)
        : await withdrawConsent(user.id);

  return NextResponse.json(status, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
