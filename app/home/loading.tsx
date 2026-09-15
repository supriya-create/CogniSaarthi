import { JourneySkeleton, LoadingRegion, Skeleton, CardSkeleton } from "@/components/ui/Skeleton";

/**
 * Shown while the home screen's plan and progress are fetched. The
 * shapes match what lands, so the page settles rather than jumps.
 */
export default function HomeLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-11 w-3/4" />
        <Skeleton className="mt-3 h-5 w-1/2" />

        <div className="mt-9">
          <JourneySkeleton />
        </div>

        <div className="mt-10 grid gap-3.5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
