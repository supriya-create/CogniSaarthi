import { NextResponse } from "next/server";

import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { deleteNote, updateNote } from "@/lib/caregiver/notes";
import { noteInputSchema } from "@/lib/validation/schemas";

/** Edit or delete one note — only the caregiver who authored it. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = noteInputSchema.partial().safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const result = await updateNote(caregiver.id, id, {
    body: parsed.data.body,
    category: parsed.data.category,
  });
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const result = await deleteNote(caregiver.id, id);
  if (result === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
