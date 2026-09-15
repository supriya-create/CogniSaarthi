import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { buildSnapshot } from "@/lib/sync/snapshot";

export const dynamic = "force-dynamic";

/**
 * Everything this device needs to keep working without a network.
 *
 * Built from the authenticated session alone, so a device can only ever
 * receive its own elder's data. The response is marked private and
 * no-store: the service worker must never put it in a shared cache —
 * it belongs in the per-user IndexedDB replica instead.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const snapshot = await buildSnapshot(user.id);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
