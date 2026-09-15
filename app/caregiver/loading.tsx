import { DashboardSkeleton, LoadingRegion, Skeleton } from "@/components/ui/Skeleton";

export default function CaregiverLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-7">
      <LoadingRegion label="Loading">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="mt-9">
          <Skeleton className="h-7 w-52" />
          <div className="mt-4">
            <DashboardSkeleton />
          </div>
        </div>
      </LoadingRegion>
    </div>
  );
}
