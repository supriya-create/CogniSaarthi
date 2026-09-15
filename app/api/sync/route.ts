import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { applySyncOperation } from "@/lib/sync/server";
import { syncPushSchema } from "@/lib/validation/schemas";
import type { SyncOperationResult } from "@/lib/offline/types";

/**
 * The offline queue's one way in.
 *
 * Identity comes from the elder's session cookie — a `userId` in the
 * body would be ignored, because the schemas do not accept one. Every
 * operation is authorised individually against that identity, and each
 * is idempotent, so a retried batch cannot duplicate anything.
 *
 * One operation failing does not fail the batch: each gets its own
 * verdict so the device can retire what succeeded and retry the rest.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = syncPushSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const results: SyncOperationResult[] = [];
  for (const operation of parsed.data.operations) {
    results.push(await applySyncOperation(user.id, operation));
  }

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
