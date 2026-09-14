import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/caregiver/access";
import { createNote } from "@/lib/caregiver/notes";
import { noteInputSchema } from "@/lib/validation/schemas";

/** Record a caregiver's observation for their linked elder. */
export async function POST(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await linkedUserFor(caregiver.id);
  if (!user) {
    return NextResponse.json({ error: "no_linked_user" }, { status: 400 });
  }

  const parsed = noteInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const note = await createNote(caregiver.id, user.id, {
    body: parsed.data.body,
    category: parsed.data.category ?? "GENERAL",
    date: parsed.data.date ? new Date(`${parsed.data.date}T12:00:00`) : undefined,
  });
  if (!note) {
    return NextResponse.json({ error: "not_authorized" }, { status: 403 });
  }
  return NextResponse.json({ id: note.id });
}
