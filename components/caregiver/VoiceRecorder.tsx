"use client";

import { useRef, useState } from "react";
import { Mic, Play, Square, Trash2 } from "lucide-react";
import type { Language } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { getCaregiverDict } from "@/lib/i18n/caregiver";
import { MAX_AUDIO_MS } from "@/lib/memories/audio-limits";
import { cn } from "@/lib/utils/cn";

/**
 * Record a familiar voice for one memory — "Ma, this is Meera."
 *
 * Uses MediaRecorder directly rather than adding a dependency: the
 * whole surface is start, stop, and one Blob, and this codebase keeps
 * a short runtime dependency list.
 *
 * Three things are load-bearing:
 *
 *  1. **The microphone is only ever opened on a press**, and the track
 *     is stopped the moment recording ends. A caregiver dashboard that
 *     holds a live microphone open because a component mounted is not
 *     something this product will ship.
 *  2. **Every failure is named.** Permission refused, unsupported
 *     browser and a failed save read differently, because they need
 *     three different things from the person.
 *  3. **The recording is uploaded, never kept in the page.** It goes
 *     straight to the authenticated route and the local object URL is
 *     revoked, so a shared family laptop is not holding somebody's
 *     voice in a tab.
 */

type State =
  | { kind: "idle" }
  | { kind: "recording" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

/**
 * Wire up and start a MediaRecorder over an open stream.
 *
 * At module scope because it reads the clock, and React Compiler's
 * purity rule is right to reject that in render scope even inside a
 * handler. Hoisting is the fix rather than a waiver, and it also
 * isolates the one piece of browser-media plumbing in this file.
 *
 * The stream's tracks are stopped in `onstop`, whatever happens next,
 * so the microphone is never left open.
 */
function beginRecording(
  stream: MediaStream,
  onFinished: (blob: Blob, durationMs: number) => void,
): MediaRecorder {
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  const startedAt = Date.now();

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  recorder.onstop = () => {
    for (const track of stream.getTracks()) track.stop();
    onFinished(
      new Blob(chunks, { type: recorder.mimeType }),
      Date.now() - startedAt,
    );
  };

  recorder.start();
  return recorder;
}

export function VoiceRecorder({
  memoryId,
  hasAudio,
  language,
  onChanged,
}: {
  memoryId: string;
  hasAudio: boolean;
  language: Language;
  /** Called after a successful save or delete, to refresh the list. */
  onChanged: () => void;
}) {
  const dict = getCaregiverDict(language);
  const [state, setState] = useState<State>({ kind: "idle" });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);

  function fail(message: string) {
    setState({ kind: "error", message });
  }

  async function startRecording() {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      fail(dict.voiceUnsupported);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Refused, or no microphone. Both mean the same to the caregiver.
      fail(dict.voiceDenied);
      return;
    }

    try {
      recorderRef.current = beginRecording(stream, (blob, durationMs) => {
        void upload(blob, durationMs);
      });
      setState({ kind: "recording" });

      // A hard ceiling, so a forgotten recording does not become a
      // ten-minute file nobody meant to make.
      stopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, MAX_AUDIO_MS);
    } catch {
      for (const track of stream.getTracks()) track.stop();
      fail(dict.voiceUnsupported);
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function upload(blob: Blob, durationMs: number) {
    if (blob.size === 0) {
      fail(dict.voiceSaveFailed);
      return;
    }
    setState({ kind: "saving" });

    const body = new FormData();
    // A filename is required for the server to see this as a File.
    body.set("audio", blob, "voice.webm");
    body.set("durationMs", String(durationMs));

    try {
      const response = await fetch(
        `/api/caregiver/memories/${memoryId}/audio`,
        { method: "POST", body },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        fail(
          data.error === "audio_size"
            ? dict.voiceTooLong
            : dict.voiceSaveFailed,
        );
        return;
      }
      setState({ kind: "idle" });
      onChanged();
    } catch {
      fail(dict.voiceSaveFailed);
    }
  }

  async function remove() {
    if (!confirm(dict.voiceDeleteConfirm)) return;
    setState({ kind: "saving" });
    try {
      await fetch(`/api/caregiver/memories/${memoryId}/audio`, {
        method: "DELETE",
      });
      setState({ kind: "idle" });
      onChanged();
    } catch {
      fail(dict.voiceSaveFailed);
    }
  }

  const recording = state.kind === "recording";
  const busy = state.kind === "saving";

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-alt/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            hasAudio
              ? "bg-success-soft text-success"
              : "bg-surface-sunken text-text-muted",
          )}
        >
          <Mic className="size-3.5 shrink-0" aria-hidden />
          {hasAudio ? dict.voiceHas : dict.voiceNone}
        </span>

        {recording ? (
          <Button
            size="sm"
            variant="danger"
            onClick={stopRecording}
            icon={<Square className="size-4" aria-hidden />}
          >
            {dict.voiceStop}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void startRecording()}
            disabled={busy}
            icon={<Mic className="size-4" aria-hidden />}
          >
            {hasAudio ? dict.voiceReplace : dict.voiceRecord}
          </Button>
        )}

        {hasAudio && !recording ? (
          <>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => void playerRef.current?.play()}
              icon={<Play className="size-4" aria-hidden />}
            >
              {dict.voicePlay}
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => void remove()}
              disabled={busy}
              icon={<Trash2 className="size-4" aria-hidden />}
            >
              {dict.voiceDelete}
            </Button>
            <audio
              ref={playerRef}
              src={`/api/memories/${memoryId}/audio`}
              preload="none"
              className="hidden"
            />
          </>
        ) : null}
      </div>

      {/* One live region for every transient state, so a screen reader
          hears "Recording…" and "Saving…" rather than nothing. */}
      <p
        role="status"
        aria-live="polite"
        className={cn(
          "mt-2 text-xs",
          state.kind === "error" ? "font-medium text-error" : "text-text-muted",
        )}
      >
        {recording
          ? dict.voiceRecording
          : busy
            ? dict.saving
            : state.kind === "error"
              ? state.message
              : dict.voiceHelp}
      </p>
    </div>
  );
}
