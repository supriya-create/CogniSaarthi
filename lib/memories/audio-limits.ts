/**
 * Limits on a familiar-voice recording, shared by both sides.
 *
 * A separate module from `audio.ts` purely because that file is
 * `server-only` — it touches the filesystem — and the caregiver's
 * recorder runs in a browser. Importing it there would pull `node:fs`
 * into a client bundle.
 *
 * The recorder uses these to stop itself before it produces something
 * the server would refuse. The server re-checks every one of them
 * anyway: a limit enforced only on the client is not a limit.
 */

/**
 * 4 MB. A one-sentence recording is tens of kilobytes; this is roughly
 * ten minutes of speech-quality audio and exists to refuse a mistaken
 * upload of a video file, not to constrain anybody.
 */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/**
 * One minute. "Ma, this is Meera" takes two seconds, and the point of
 * the ceiling is that a recording left running by accident does not
 * become a file nobody meant to make.
 */
export const MAX_AUDIO_MS = 60_000;
