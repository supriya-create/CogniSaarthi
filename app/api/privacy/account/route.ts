import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { endSession } from "@/lib/auth/session";
import { deleteAccount, planAccountDeletion } from "@/lib/privacy/data-deletion";
import { accountDeletionSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * Deleting an elder's own account.
 *
 * Three guards, because this is the one irreversible action in the
 * product and the person taking it may not fully appreciate that:
 *
 *  1. **The elder's own session, and only theirs.** Identity comes
 *     from the ELDER cookie. There is no caregiver path here and no
 *     `userId` in the schema, so a caregiver signed in on the same
 *     shared tablet cannot delete the person they look after. That is
 *     the same position as research consent: a care relationship is
 *     not established legal authority over another adult.
 *
 *  2. **An explicit confirmation token in the body.** A bare DELETE to
 *     this path does nothing. It has to say so in words, so a stray
 *     request, a prefetch or a mis-wired button cannot destroy
 *     somebody's photographs.
 *
 *  3. **The session ends server-side.** The cookie is dropped in the
 *     same request, so the browser cannot be left holding a token for
 *     a user row that no longer exists.
 *
 * The actual work is `deleteAccount` in lib/privacy/data-deletion.ts,
 * which already existed and is already tested. This route does not
 * reimplement any part of it — notably not the photograph unlinking,
 * which is the part a second implementation would get wrong.
 */

/** What a deletion would remove, without removing anything. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const plan = await planAccountDeletion(user.id);
  if (!plan) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(plan, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = accountDeletionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    // Missing or wrong confirmation. Deliberately NOT treated as a
    // partial success of any kind — nothing has been touched.
    return NextResponse.json({ error: "not_confirmed" }, { status: 400 });
  }

  const result = await deleteAccount(user.id);
  if (!result.deleted) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The row is gone; the cookie must go with it. Only the ELDER
  // session — a caregiver signed in on this tablet keeps theirs.
  await endSession("ELDER");

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
