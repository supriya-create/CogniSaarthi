import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function GamesLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-5 w-1/2" />
        <div className="mt-8 flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} className="py-8" />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
