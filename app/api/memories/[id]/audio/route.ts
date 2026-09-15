import {
  getCurrentCaregiver,
  getCurrentUser,
} from "@/lib/auth/current-user";
import { readMemoryAudio } from "@/lib/memories/audio";
import { getMemoryAudioFor } from "@/lib/memories/server";

/**
 * Serve a memory's familiar-voice recording, only to someone allowed
 * to hear it:
 *   - the elder the memory belongs to, or
 *   - a caregiver actively linked to that elder.
 *
 * Everyone else gets 404. The recording has no public URL, and the
 * response deliberately does not distinguish "no recording", "no such
 * memory" and "not yours" — so an id cannot be probed for existence.
 *
 * Deliberately identical in shape to the image route beside it. These
 * two are the only ways private media leaves the server, and a reader
 * who has checked one has effectively checked the other.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [user, caregiver] = await Promise.all([
    getCurrentUser(),
    getCurrentCaregiver(),
  ]);

  // Authorisation and lookup happen together, scoped by the viewer,
  // so there is no branch in which a row is read and then checked.
  const audio = await getMemoryAudioFor(id, {
    userId: user?.id ?? null,
    caregiverId: caregiver?.id ?? null,
  });
  if (!audio) return new Response("Not found", { status: 404 });

  const file = await readMemoryAudio(audio.path);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      // Private and never stored: this is a family member's voice on a
      // device that may be shared. The service worker is forbidden
      // from caching /api at all; this says the same thing to every
      // other cache between here and the speaker.
      "Cache-Control": "private, no-store",
      "Content-Length": String(file.bytes.byteLength),
    },
  });
}
