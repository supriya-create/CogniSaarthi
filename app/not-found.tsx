import { House } from "lucide-react";

import { LinkButton } from "@/components/ui/Button";
import { LogoMark } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center">
      <LogoMark className="size-20 opacity-70" />
      <h1 className="mt-8 font-serif text-3xl font-semibold">
        We could not find that page.
      </h1>
      <p className="mt-3 text-xl text-text-muted">
        Let&apos;s go back to somewhere familiar.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <LinkButton
          href="/home"
          fullWidth
          icon={<House className="size-6" aria-hidden />}
        >
          Home
        </LinkButton>
      </div>
    </div>
  );
}
