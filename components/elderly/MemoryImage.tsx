"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { Language } from "@prisma/client";

import { getDict } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils/cn";

/**
 * A memory photo, served through the existing authenticated route.
 *
 * Photos are never bundled into the offline cache: they are private
 * family pictures, and putting them in a shared cache would be the
 * wrong trade. So when there is no connection the image simply cannot
 * load — and rather than a broken-image icon, the person gets a calm
 * sentence explaining it will be back. The memory's name and note are
 * cached and still shown, so the card is never empty.
 */
export function MemoryImage({
  id,
  alt,
  language,
  className,
}: {
  id: string;
  alt: string;
  language: Language;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dict = getDict(language);

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
        <ImageOff className="size-8 shrink-0 text-border-strong" aria-hidden />
        <p className="text-sm leading-snug text-text-muted">
          {dict.offlinePhotoUnavailable}
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/memories/${id}/image`}
      alt={alt}
      onError={() => setFailed(true)}
      className={cn("size-full object-cover", className)}
    />
  );
}
