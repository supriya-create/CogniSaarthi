import { prisma } from "@/lib/db/prisma";
import {
  getCurrentCaregiver,
  getCurrentUser,
} from "@/lib/auth/current-user";
import { caregiverLinkedTo } from "@/lib/memories/queries";
import { readMemoryImage } from "@/lib/memories/storage";

/**
 * Serve a memory image, only to someone allowed to see it:
 *   - the elder the memory belongs to, or
 *   - a caregiver actively linked to that elder.
 * Everyone else gets 404 — the image never has a public URL, and the
 * response deliberately does not distinguish "missing" from
 * "forbidden".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const memory = await prisma.personalMemory.findUnique({
    where: { id },
    select: { userId: true, imagePath: true },
  });
  if (!memory?.imagePath) {
    return new Response("Not found", { status: 404 });
  }

  const [user, caregiver] = await Promise.all([
    getCurrentUser(),
    getCurrentCaregiver(),
  ]);

  const isOwnerElder = user?.id === memory.userId;
  const isLinkedCaregiver =
    caregiver !== null &&
    (await caregiverLinkedTo(caregiver.id, memory.userId));

  if (!isOwnerElder && !isLinkedCaregiver) {
    return new Response("Not found", { status: 404 });
  }

  const image = await readMemoryImage(memory.imagePath);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.contentType,
      // Private: caches must revalidate and never share across users.
      "Cache-Control": "private, no-store",
    },
  });
}
