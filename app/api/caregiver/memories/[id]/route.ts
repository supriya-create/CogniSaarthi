import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { getMemoryForCaregiver } from "@/lib/memories/queries";
import { deleteMemoryAudio } from "@/lib/memories/audio";
import { deleteMemoryImage, saveMemoryImage } from "@/lib/memories/storage";
import { memoryFieldsSchema } from "@/lib/validation/schemas";

/**
 * Update or delete one memory. Both first re-check that the memory
 * exists AND belongs to an elder this caregiver is linked to — a
 * caregiver can never reach another family's memory by guessing an id
 * (the check returns the same "not found" either way).
 */

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getMemoryForCaregiver(id, caregiver.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = memoryFieldsSchema.partial().safeParse({
    category: form.get("category") ?? undefined,
    title: form.get("title") ?? undefined,
    relationship: form.get("relationship") ?? undefined,
    description: form.get("description") ?? undefined,
    enabled:
      form.get("enabled") === null ? undefined : form.get("enabled") === "true",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  let imagePath = existing.imagePath;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    const result = await saveMemoryImage(image);
    if ("error" in result) {
      return NextResponse.json(
        { error: `image_${result.error}` },
        { status: 400 },
      );
    }
    // Replace: drop the old file once the new one is safely written.
    if (existing.imagePath) await deleteMemoryImage(existing.imagePath);
    imagePath = result.imagePath;
  } else if (form.get("removeImage") === "true" && existing.imagePath) {
    await deleteMemoryImage(existing.imagePath);
    imagePath = null;
  }

  const data = parsed.data;
  await prisma.personalMemory.update({
    where: { id },
    data: {
      ...(data.category !== undefined && { category: data.category }),
      ...(data.title !== undefined && { title: data.title }),
      ...(data.relationship !== undefined && {
        relationship: data.relationship || null,
      }),
      ...(data.description !== undefined && {
        description: data.description || null,
      }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
      imagePath,
    },
  });

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
  const existing = await getMemoryForCaregiver(id, caregiver.id);
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The familiar-voice recording too. `MemoryAudio` cascades away with
  // the memory, which makes forgetting this invisible: the database
  // looks clean while a recording of somebody's daughter saying their
  // name is still on the disk. Read the path before the cascade takes
  // the row that names it.
  const audio = await prisma.memoryAudio.findUnique({
    where: { memoryId: id },
    select: { path: true },
  });

  if (existing.imagePath) await deleteMemoryImage(existing.imagePath);
  if (audio) await deleteMemoryAudio(audio.path);
  await prisma.personalMemory.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
