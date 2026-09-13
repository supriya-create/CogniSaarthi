"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";

/**
 * No stack trace, no error code, no apology in six sentences.
 * One plain statement and one thing to press.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <LogoMark className="size-20 opacity-70" />
      <h1 className="mt-8 font-serif text-3xl font-semibold">
        Something went wrong.
      </h1>
      <p className="mt-3 text-xl text-text-muted">Let&apos;s try that again.</p>
      <div className="mt-8 w-full max-w-xs">
        <Button
          fullWidth
          onClick={reset}
          icon={<RotateCcw className="size-6" aria-hidden />}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
