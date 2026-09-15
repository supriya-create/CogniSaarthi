import { CardSkeleton, LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function HistoryLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-3 h-5 w-2/3" />
        <div className="mt-8 flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
