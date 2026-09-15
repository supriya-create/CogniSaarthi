import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function MemoriesLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="mt-3 h-5 w-2/3" />
        <div className="mt-9 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i}>
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="mt-2.5 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}
