import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  baseMimeType,
  deleteMemoryAudio,
  isAllowedAudioType,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_MS,
  normaliseDuration,
  readMemoryAudio,
  saveMemoryAudio,
} from "@/lib/memories/audio";

/**
 * THE FAMILIAR VOICE, AND WHY IT IS DANGEROUS.
 *
 * A recording of somebody's daughter saying their name is as private
 * as the photograph beside it, and it arrives as an uploaded file with
 * a client-supplied content type — so the two things this file guards
 * are the allowlist on the way in and the traversal guard on the way
 * out.
 *
 * `storage/` is under a `.gitignore`d directory and these tests write
 * real files into it; each one cleans up after itself.
 */

function file(bytes: Uint8Array, type: string, name = "voice.webm"): File {
  // `.buffer` rather than the view: TypeScript's BlobPart does not
  // accept a Uint8Array over an arbitrary ArrayBufferLike, and the
  // bytes are identical either way.
  return new File([bytes.buffer as ArrayBuffer], name, { type });
}

const SOME_AUDIO = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03]);

describe("content types", () => {
  it("accepts what browsers actually record", () => {
    // Chrome and Firefox produce webm; Safari produces mp4.
    expect(isAllowedAudioType("audio/webm")).toBe(true);
    expect(isAllowedAudioType("audio/mp4")).toBe(true);
    expect(isAllowedAudioType("audio/ogg")).toBe(true);
    expect(isAllowedAudioType("audio/mpeg")).toBe(true);
    expect(isAllowedAudioType("audio/wav")).toBe(true);
  });

  it("looks past the codec parameter MediaRecorder adds", () => {
    // Without this a perfectly ordinary recording is refused.
    expect(baseMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(isAllowedAudioType("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedAudioType("audio/mp4; codecs=mp4a.40.2")).toBe(true);
  });

  it("is case-insensitive about the type", () => {
    expect(isAllowedAudioType("AUDIO/WEBM")).toBe(true);
  });

  it("refuses anything that is not audio", () => {
    for (const type of [
      "video/mp4",
      "image/png",
      "text/html",
      "application/javascript",
      "application/octet-stream",
      "",
    ]) {
      expect(isAllowedAudioType(type), type).toBe(false);
    }
  });

  it("refuses an unknown type rather than guessing an extension", () => {
    // The extension chosen here is what the read path later uses to
    // decide a Content-Type, so a guess would be a stored-XSS vector.
    expect(isAllowedAudioType("audio/exotic")).toBe(false);
  });
});

describe("saving a recording", () => {
  it("stores an allowed one under a generated name", async () => {
    const result = await saveMemoryAudio(file(SOME_AUDIO, "audio/webm"));
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    // A bare filename, never a path and never the uploaded name.
    expect(result.path).not.toContain("/");
    expect(result.path).toMatch(/^[0-9a-f-]+\.webm$/);
    expect(result.mimeType).toBe("audio/webm");
    expect(result.bytes).toBe(SOME_AUDIO.byteLength);

    await deleteMemoryAudio(result.path);
  });

  it("ignores the filename the client chose", async () => {
    const result = await saveMemoryAudio(
      file(SOME_AUDIO, "audio/webm", "../../../etc/passwd"),
    );
    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.path).not.toContain("..");
    expect(result.path).not.toContain("passwd");
    await deleteMemoryAudio(result.path);
  });

  it("refuses a disallowed type", async () => {
    const result = await saveMemoryAudio(file(SOME_AUDIO, "video/mp4"));
    expect(result).toEqual({ error: "type" });
  });

  it("refuses an empty file", async () => {
    const result = await saveMemoryAudio(
      file(new Uint8Array(0), "audio/webm"),
    );
    expect(result).toEqual({ error: "size" });
  });

  it("refuses one over the size ceiling", async () => {
    const tooBig = new Uint8Array(MAX_AUDIO_BYTES + 1);
    const result = await saveMemoryAudio(file(tooBig, "audio/webm"));
    expect(result).toEqual({ error: "size" });
  });

  it("checks the ACTUAL bytes, not the reported size", async () => {
    // A `File` whose `size` lies is trivially constructed; the guard
    // that matters is the one after the bytes are read.
    const bytes = new Uint8Array(MAX_AUDIO_BYTES + 1);
    const liar = file(bytes, "audio/webm");
    Object.defineProperty(liar, "size", { value: 10 });

    expect(await saveMemoryAudio(liar)).toEqual({ error: "size" });
  });
});

describe("reading a recording back", () => {
  it("returns the bytes and the right content type", async () => {
    const saved = await saveMemoryAudio(file(SOME_AUDIO, "audio/webm"));
    expect("error" in saved).toBe(false);
    if ("error" in saved) return;

    const read = await readMemoryAudio(saved.path);
    expect(read?.contentType).toBe("audio/webm");
    expect(read?.bytes.byteLength).toBe(SOME_AUDIO.byteLength);

    await deleteMemoryAudio(saved.path);
  });

  it("refuses anything that is not a bare filename", async () => {
    // The stored value only ever IS a bare filename, so a value that
    // is not one means the row has been tampered with.
    for (const attempt of [
      "../.env",
      "../../etc/passwd",
      "sub/dir.webm",
      "..\\windows\\system32",
      "..",
      "",
    ]) {
      expect(await readMemoryAudio(attempt), attempt).toBeNull();
    }
  });

  it("refuses a filename whose extension it does not serve", async () => {
    expect(await readMemoryAudio("something.html")).toBeNull();
    expect(await readMemoryAudio("something.js")).toBeNull();
    expect(await readMemoryAudio("noextension")).toBeNull();
  });

  it("returns null for a file that is not there, rather than throwing", async () => {
    expect(await readMemoryAudio("00000000-0000-0000-0000-000000000000.webm"))
      .toBeNull();
  });

  it("refuses to delete through a traversal too", async () => {
    // Nothing to assert but the absence of an explosion — and of a
    // deleted file outside the audio root.
    await expect(deleteMemoryAudio("../../package.json")).resolves
      .toBeUndefined();
    expect(readFileSync(path.join(process.cwd(), "package.json"))).toBeTruthy();
  });
});

describe("recording length", () => {
  it("keeps a sensible duration", () => {
    expect(normaliseDuration(2400)).toBe(2400);
    expect(normaliseDuration("2400")).toBe(2400);
  });

  it("clamps one longer than the ceiling", () => {
    expect(normaliseDuration(MAX_AUDIO_MS * 10)).toBe(MAX_AUDIO_MS);
  });

  it("drops a nonsense value rather than storing 0", () => {
    // Null means "not measured". Zero would render as an empty clip.
    for (const value of [0, -1, Number.NaN, Infinity, "abc", null, undefined, {}]) {
      expect(normaliseDuration(value), String(value)).toBeNull();
    }
  });
});

describe("recordings never become public", () => {
  it("is stored outside the web root", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib", "memories", "audio.ts"),
      "utf8",
    );
    // `./storage`, beside the memory images — never `public/`, which
    // Next serves to anybody who can guess a filename.
    expect(source).toContain('"storage"');
    expect(source).not.toContain('"public"');
  });

  it("is served with private, no-store caching", () => {
    const route = readFileSync(
      path.join(
        process.cwd(),
        "app",
        "api",
        "memories",
        "[id]",
        "audio",
        "route.ts",
      ),
      "utf8",
    );
    expect(route).toContain('"private, no-store"');
  });

  it("is refused to anybody who is not the elder or a linked caregiver", () => {
    const route = readFileSync(
      path.join(
        process.cwd(),
        "app",
        "api",
        "memories",
        "[id]",
        "audio",
        "route.ts",
      ),
      "utf8",
    );
    // 404 for "no recording", "no such memory" and "not yours" alike,
    // so an id cannot be probed for existence.
    expect(route).toContain("getMemoryAudioFor");
    expect(route).toContain("404");
    expect(route).not.toContain("403");
  });

  it("is never cached by the service worker", () => {
    const sw = readFileSync(
      path.join(process.cwd(), "public", "sw.js"),
      "utf8",
    );
    // The worker's static-asset allowlist is the thing that decides,
    // and /api is not on it. Assert the allowlist rather than the
    // absence of a string, which would pass for the wrong reason.
    const allowlist = sw.slice(
      sw.indexOf("function isStaticAsset"),
      sw.indexOf("self.addEventListener(\"fetch\""),
    );
    expect(allowlist).not.toContain("/api");
    expect(allowlist).toContain("/_next/static/");
  });
});
