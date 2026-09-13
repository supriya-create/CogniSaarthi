import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentCaregiver } from "@/lib/auth/current-user";
import { linkedUserFor } from "@/lib/memories/queries";
import { saveMemoryImage } from "@/lib/memories/storage";
import { memoryFieldsSchema } from "@/lib/validation/schemas";

/**
 * Create a personal memory for the elder this caregiver is linked to.
 * Accepts multipart form data so an optional photo can be uploaded in
 * the same request. Authorization is implicit: the memory is always
 * created for the caregiver's OWN linked user, never an arbitrary id.
 */
export async function POST(request: Request) {
  const caregiver = await getCurrentCaregiver();
  if (!caregiver) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const user = await linkedUserFor(caregiver.id);
  if (!user) {
    return NextResponse.json({ error: "no_linked_user" }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = memoryFieldsSchema.safeParse({
    category: form.get("category"),
    title: form.get("title"),
    relationship: form.get("relationship") ?? undefined,
    description: form.get("description") ?? undefined,
    enabled: form.get("enabled") === null ? undefined : form.get("enabled") === "true",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  let imagePath: string | null = null;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) {
    const result = await saveMemoryImage(image);
    if ("error" in result) {
      return NextResponse.json(
        { error: `image_${result.error}` },
        { status: 400 },
      );
    }
    imagePath = result.imagePath;
  }

  const memory = await prisma.personalMemory.create({
    data: {
      userId: user.id,
      caregiverId: caregiver.id,
      category: parsed.data.category,
      title: parsed.data.title,
      relationship: parsed.data.relationship || null,
      description: parsed.data.description || null,
      enabled: parsed.data.enabled ?? true,
      imagePath,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: memory.id });
}
