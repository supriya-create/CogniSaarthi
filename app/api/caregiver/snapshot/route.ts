import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { buildCaregiverSnapshot } from "@/lib/caregiver/snapshot";

export const dynamic = "force-dynamic";

/**
 * The caregiver's offline snapshot.
 *
 * Identity comes from the caregiver session cookie and nothing else.
 * There is no `userId` parameter, no query string and no body — so
 * there is nothing for a caller to forge. `buildCaregiverSnapshot`
 * resolves the elder from the caregiver's own ACTIVE link; a caregiver
 * with no link gets a 404, not somebody else's data.
 *
 * `private, no-store` matters more than usual here: the service worker
 * never caches /api at all, and this response must not end up in the
 * browser's HTTP cache either. The only place it is allowed to persist
 * is the per-caregiver IndexedDB store, which is cleared on sign-out
 * and when a different caregiver signs in.
 */
export async function GET() {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const snapshot = await buildCaregiverSnapshot(caregiver.id);
  if (!snapshot) {
    return NextResponse.json({ error: "no_linked_elder" }, { status: 404 });
  }

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
