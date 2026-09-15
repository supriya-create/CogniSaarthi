import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

/**
 * Shaped like the Memory Lane intro card, so the page settles into
 * place rather than jumping when the memories arrive. The label is
 * the one thing a screen reader hears; the boxes are hidden from it.
 *
 * Deliberately untranslated: `loading.tsx` renders before the route's
 * own data — including which language this person reads — and a
 * flash of English is a smaller wrong than blocking the skeleton on a
 * database round trip to find out.
 */
export default function MemoryLaneLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-6 w-20" />
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-9">
          <div className="flex flex-col items-center">
            <Skeleton className="size-20 rounded-full" />
            <Skeleton className="mt-6 h-9 w-56" />
            <Skeleton className="mt-4 h-5 w-64" />
            <Skeleton className="mt-2.5 h-5 w-48" />
            <Skeleton className="mt-8 h-16 w-full max-w-xs rounded-2xl" />
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
