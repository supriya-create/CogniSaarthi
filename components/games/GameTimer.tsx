"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The viewing countdown.
 *
 * Shows a shrinking bar AND the number of seconds left in words —
 * a bar alone gives no sense of how long "a bit more" is, and a
 * number alone is easy to miss while concentrating on the pictures.
 */
export function GameTimer({
  seconds,
  onDone,
  label,
  secondsLabel,
}: {
  seconds: number;
  onDone: () => void;
  label: string;
  secondsLabel: string;
}) {
  const totalMs = seconds * 1000;
  const [remaining, setRemaining] = useState(totalMs);

  // Held in a ref so the interval below never restarts just because
  // the parent re-rendered with a new closure.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const left = Math.max(0, totalMs - (Date.now() - startedAt));
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(id);
        onDoneRef.current();
      }
    }, 100);

    return () => window.clearInterval(id);
  }, [totalMs]);

  const secondsLeft = Math.ceil(remaining / 1000);
  const percent = totalMs === 0 ? 0 : (remaining / totalMs) * 100;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold">{label}</span>
        <span
          className="numeric text-lg font-semibold text-text-muted"
          aria-live="off"
        >
          {secondsLeft} {secondsLabel}
        </span>
      </div>
      <div
        className="mt-2 h-3.5 w-full overflow-hidden rounded-full border border-border bg-surface-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={seconds}
        aria-valuenow={secondsLeft}
        aria-label={label}
      >
        <div
          className={
            // The colour shift is a second, redundant cue; the number
            // of seconds beside it is the one that actually informs.
            "h-full rounded-full transition-[width,background-color] duration-100 ease-linear " +
            (percent <= 25 ? "bg-accent" : "bg-primary")
          }
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
