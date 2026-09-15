import { cn } from "@/lib/utils/cn";

/**
 * Loading placeholders.
 *
 * They mirror the shape of the thing being loaded so the page does
 * not jump when the content lands. The whole group is hidden from
 * screen readers and announced once, in words, by the wrapper —
 * a reader should hear "Loading", not eleven grey boxes.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton", className)} />;
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Wraps a set of skeletons and gives them a single spoken label. */
export function LoadingRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 shadow-soft",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-2xl" />
        <div className="flex-1">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="mt-2.5 h-4 w-3/4" />
        </div>
      </div>
    </div>
  );
}

export function JourneySkeleton() {
  return (
    <div
      aria-hidden
      className="rounded-2xl border border-border bg-surface p-6 shadow-soft"
    >
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="mt-6 h-14 w-full rounded-2xl" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <Skeleton className="h-6 w-48" />
        <div className="mt-5 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
