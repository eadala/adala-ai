/**
 * SkeletonCard — Loading placeholder cards for mobile list views
 */
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border/50 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} className={`h-2.5 ${i % 2 === 0 ? "w-full" : "w-3/4"}`} />
      ))}
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-7 flex-1 rounded-lg" />
        <Skeleton className="h-7 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonCardList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={i % 2 === 0 ? 2 : 3} />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 p-4 sm:grid-cols-${Math.min(count, 4)}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border/50 p-4 space-y-2 animate-pulse">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}
