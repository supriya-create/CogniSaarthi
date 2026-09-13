import { Heart } from "lucide-react";

/**
 * One memory in the elder's gallery: a photo (served through the
 * authenticated image route), a name, and a gentle note. Large and
 * calm, not a data grid.
 */
export function MemoryCard({
  id,
  title,
  relationship,
  description,
  hasImage,
}: {
  id: string;
  title: string;
  relationship: string | null;
  description: string | null;
  hasImage: boolean;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex aspect-square items-center justify-center bg-surface-alt">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/memories/${id}/image`}
            alt={title}
            className="size-full object-cover"
          />
        ) : (
          <Heart className="size-10 text-border-strong" aria-hidden />
        )}
      </div>
      <div className="p-3">
        <p className="text-lg font-semibold leading-tight">{title}</p>
        {relationship ? (
          <p className="text-base text-text-muted">{relationship}</p>
        ) : null}
        {description ? (
          <p className="mt-1 text-sm leading-snug text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
    </li>
  );
}
