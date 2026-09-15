import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function RemindersLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-9 sm:px-6">
      <LoadingRegion label="Loading">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-10 w-2/3" />
        <ol className="mt-8 flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-4">
              <Skeleton className="mt-4 h-5 w-16" />
              <Skeleton className="h-32 flex-1 rounded-2xl" />
            </li>
          ))}
        </ol>
      </LoadingRegion>
    </div>
  );
}
