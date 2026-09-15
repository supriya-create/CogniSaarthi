"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { MessageScreen } from "@/components/ui/MessageScreen";

/**
 * No stack trace, no error code, no apology in six sentences.
 * One plain statement and one thing to press.
 *
 * The real error goes to the console, where a developer will find it,
 * and nowhere near the person using the app.
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
    <MessageScreen
      title="Something went wrong."
      body="We couldn't load this right now. Please try again."
      action={
        <Button
          fullWidth
          onClick={reset}
          icon={<RotateCcw className="size-6" aria-hidden />}
        >
          Try again
        </Button>
      }
    />
  );
}
