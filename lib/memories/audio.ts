import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { MAX_AUDIO_BYTES, MAX_AUDIO_MS } from "@/lib/memories/audio-limits";

/**
 * Private audio storage for a caregiver's familiar voice.
 *
 * Deliberately the same shape as `storage.ts` for images, down to the
 * traversal guard, because the risk is the same one: a file on disk
 * whose name comes out of a database row. Sharing the shape means a
 * reader who has checked one has effectively checked the other, and a
 * future fix to one is an obvious fix to the other.
 *
 * Files live OUTSIDE the web root (./storage), so there is no public
 * URL for a recording of somebody's daughter saying their name. They
 * are only returned through an authenticated route, and the service
 * worker is forbidden from caching that route.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "memory-audio");

/**
 * What a browser's MediaRecorder actually produces, plus the two
 * formats a caregiver might upload from a phone.
 *
 * Chrome and Firefox record `audio/webm`, Safari records `audio/mp4`.
 * The list is an ALLOWLIST: an unrecognised type is refused rather
 * than stored with a guessed extension, because the extension is what
 * the read path later uses to decide a Content-Type.
 */
const ALLOWED: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

// The numbers live in `audio-limits.ts` so the caregiver's recorder
// can stop itself before producing something this would refuse. They
// are re-checked here regardless: a limit enforced only on the client
// is not a limit.
export { MAX_AUDIO_BYTES, MAX_AUDIO_MS };

export interface AudioValidationError {
  error: "type" | "size";
}

export interface StoredAudio {
  path: string;
  mimeType: string;
  bytes: number;
}

/**
 * Normalise a browser's content type.
 *
 * MediaRecorder reports codecs in the type ("audio/webm;codecs=opus"),
 * which would miss a bare-string allowlist lookup and get a perfectly
 * ordinary recording refused.
 */
export function baseMimeType(type: string): string {
  return type.split(";")[0]!.trim().toLowerCase();
}

export function isAllowedAudioType(type: string): boolean {
  return baseMimeType(type) in ALLOWED;
}

/** Validate and persist an uploaded recording. */
export async function saveMemoryAudio(
  file: File,
): Promise<StoredAudio | AudioValidationError> {
  const mimeType = baseMimeType(file.type);
  const ext = ALLOWED[mimeType];
  if (!ext) return { error: "type" };
  if (file.size > MAX_AUDIO_BYTES) return { error: "size" };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Re-check against the actual bytes, not the reported size.
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { error: "size" };
  if (bytes.byteLength === 0) return { error: "size" };

  await mkdir(STORAGE_ROOT, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(STORAGE_ROOT, name), bytes);

  return { path: name, mimeType, bytes: bytes.byteLength };
}

const CONTENT_TYPE: Record<string, string> = {
  webm: "audio/webm",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

/**
 * Read a stored recording.
 *
 * Guards against path traversal in the DB value, exactly as the image
 * reader does. Only a bare filename is ever written, so anything
 * containing a separator or a dot-segment is refused outright rather
 * than resolved and compared — there is no path arithmetic here for a
 * clever value to win.
 */
export async function readMemoryAudio(
  storedPath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (
    storedPath.includes("/") ||
    storedPath.includes("\\") ||
    storedPath.includes("..") ||
    storedPath.length === 0
  ) {
    return null;
  }

  const ext = storedPath.split(".").pop() ?? "";
  const contentType = CONTENT_TYPE[ext];
  if (!contentType) return null;

  try {
    const bytes = await readFile(path.join(STORAGE_ROOT, storedPath));
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export async function deleteMemoryAudio(storedPath: string): Promise<void> {
  if (
    storedPath.includes("/") ||
    storedPath.includes("\\") ||
    storedPath.includes("..")
  ) {
    return;
  }
  try {
    await unlink(path.join(STORAGE_ROOT, storedPath));
  } catch {
    // Already gone — nothing to do.
  }
}

/** Clamp a client-reported duration, or drop it if it is nonsense. */
export function normaliseDuration(value: unknown): number | null {
  const ms = typeof value === "string" ? Number(value) : value;
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(Math.round(ms), MAX_AUDIO_MS);
}
