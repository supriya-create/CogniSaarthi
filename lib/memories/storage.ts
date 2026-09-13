import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private image storage for personal memories.
 *
 * Files live OUTSIDE the web root (in ./storage), so there is no
 * public URL that could leak a family photo. They are only ever
 * returned through an authenticated route that checks the requester
 * is allowed to see that elder's memories.
 */

const STORAGE_ROOT = path.join(process.cwd(), "storage", "memory-images");

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ImageValidationError {
  error: "type" | "size";
}

/** Validate and persist an uploaded image. Returns the stored path
 *  (relative, safe to keep in the DB) or a typed validation error. */
export async function saveMemoryImage(
  file: File,
): Promise<{ imagePath: string } | ImageValidationError> {
  const ext = ALLOWED[file.type];
  if (!ext) return { error: "type" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "size" };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Re-check size against the actual bytes, not just the reported size.
  if (bytes.byteLength > MAX_IMAGE_BYTES) return { error: "size" };

  await mkdir(STORAGE_ROOT, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(STORAGE_ROOT, name), bytes);
  return { imagePath: name };
}

const CONTENT_TYPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Read a stored image. Guards against path traversal in the DB value. */
export async function readMemoryImage(
  imagePath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  // Only a bare filename is ever stored; reject anything else.
  if (imagePath.includes("/") || imagePath.includes("..")) return null;

  const ext = imagePath.split(".").pop() ?? "";
  const contentType = CONTENT_TYPE[ext];
  if (!contentType) return null;

  try {
    const bytes = await readFile(path.join(STORAGE_ROOT, imagePath));
    return { bytes, contentType };
  } catch {
    return null;
  }
}

export async function deleteMemoryImage(imagePath: string): Promise<void> {
  if (imagePath.includes("/") || imagePath.includes("..")) return;
  try {
    await unlink(path.join(STORAGE_ROOT, imagePath));
  } catch {
    // Already gone — nothing to do.
  }
}
