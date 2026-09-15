import { Camera, MapPin, Package, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Language, MemoryCategory } from "@prisma/client";

import { MemoryImage } from "@/components/elderly/MemoryImage";
import { cn } from "@/lib/utils/cn";

/**
 * Each category gets its own mark and its own tint, so a wall of
 * photos still has some structure to it and a card with no photo is
 * still recognisably a person, a place, a thing or a moment.
 */
const CATEGORY: Record<
  MemoryCategory,
  { Icon: LucideIcon; plate: string; tint: string }
> = {
  PERSON: {
    Icon: Users,
    plate: "text-primary",
    tint: "from-primary-soft to-primary-tint",
  },
  PLACE: {
    Icon: MapPin,
    plate: "text-secondary",
    tint: "from-secondary-soft to-surface-alt",
  },
  THING: {
    Icon: Package,
    plate: "text-warning",
    tint: "from-accent-soft to-surface-alt",
  },
  MOMENT: {
    Icon: Sparkles,
    plate: "text-primary",
    tint: "from-sage-soft to-surface-alt",
  },
};

/**
 * One memory in the elder's album: a photo (served through the
 * authenticated image route), a name, and a gentle note. Large and
 * calm, printed rather than tabulated — the page should feel like a
 * photo album someone put together, not a list of records.
 *
 * The title and note come from the offline cache, so the card still
 * reads properly without a connection; only the photo needs the
 * network, and it degrades to an illustrated placeholder rather than
 * a broken image.
 */
export function MemoryCard({
  id,
  title,
  relationship,
  description,
  category,
  hasImage,
  language,
}: {
  id: string;
  title: string;
  relationship: string | null;
  description: string | null;
  category: MemoryCategory;
  hasImage: boolean;
  language: Language;
}) {
  const { Icon, plate, tint } = CATEGORY[category];

  return (
    <li className="panel panel-interactive group overflow-hidden p-0">
      <div className="relative aspect-square overflow-hidden">
        {hasImage ? (
          <MemoryImage
            id={id}
            alt={title}
            language={language}
            className="transition-transform duration-500 ease-out-soft group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={cn(
              "flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br",
              tint,
            )}
          >
            <Icon className={cn("size-12", plate)} strokeWidth={1.5} aria-hidden />
            <Camera
              className="size-5 text-text-faint"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
        )}

        {/* Category mark, always present, so the tint is never the
            only thing saying what kind of memory this is. */}
        <span
          aria-hidden
          className="absolute top-2.5 left-2.5 flex size-9 items-center justify-center rounded-full border border-border bg-surface/90 shadow-soft backdrop-blur-sm"
        >
          <Icon className={cn("size-5", plate)} strokeWidth={2} />
        </span>
      </div>

      <div className="p-3.5">
        <p className="font-serif text-lg leading-tight font-semibold">
          {title}
        </p>
        {relationship ? (
          <p className="mt-0.5 text-base font-medium text-text-muted">
            {relationship}
          </p>
        ) : null}
        {description ? (
          <p className="mt-1.5 text-sm leading-snug text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
    </li>
  );
}
