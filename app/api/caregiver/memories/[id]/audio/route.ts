import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { getMemoryForCaregiver } from "@/lib/memories/queries";
import {
  deleteMemoryAudio,
  normaliseDuration,
  saveMemoryAudio,
} from "@/lib/memories/audio";

/**
 * Record, replace or remove the familiar voice for one memory.
 *
 * Authorization first and always: `getMemoryForCaregiver` returns the
 * memory only when this caregiver is ACTIVELY linked to the elder it
 * belongs to, and returns the same null for "does not exist" as for
 * "not yours" — so a caregiver cannot discover another family's
 * memory by guessing an id.
 *
 * There is no POST-by-id-with-a-userId anywhere here. The elder is
 * reached through the link, never named in a body.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const memory = await getMemoryForCaregiver(id, caregiver.id);
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!form || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const stored = await saveMemoryAudio(file);
  if ("error" in stored) {
    return NextResponse.json(
      { error: `audio_${stored.error}` },
      { status: 400 },
    );
  }

  const durationMs = normaliseDuration(form.get("durationMs"));

  // Replace: write the new file first, then upsert, then drop the old
  // one. In that order a failure anywhere leaves a playable recording
  // rather than a row pointing at a file that is no longer there.
  const existing = await prisma.memoryAudio.findUnique({
    where: { memoryId: memory.id },
    select: { path: true },
  });

  await prisma.memoryAudio.upsert({
    where: { memoryId: memory.id },
    create: {
      memoryId: memory.id,
      caregiverId: caregiver.id,
      path: stored.path,
      mimeType: stored.mimeType,
      bytes: stored.bytes,
      durationMs,
    },
    update: {
      caregiverId: caregiver.id,
      path: stored.path,
      mimeType: stored.mimeType,
      bytes: stored.bytes,
      durationMs,
    },
  });

  if (existing && existing.path !== stored.path) {
    await deleteMemoryAudio(existing.path);
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
  const memory = await getMemoryForCaregiver(id, caregiver.id);
  if (!memory) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.memoryAudio.findUnique({
    where: { memoryId: memory.id },
    select: { id: true, path: true },
  });
  // Already gone is a success: a caregiver who pressed delete twice
  // has got what they asked for.
  if (!existing) return NextResponse.json({ ok: true });

  await prisma.memoryAudio.delete({ where: { id: existing.id } });
  await deleteMemoryAudio(existing.path);

  return NextResponse.json({ ok: true });
}
