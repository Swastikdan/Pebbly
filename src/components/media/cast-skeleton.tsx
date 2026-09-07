import { Skeleton } from "@/components/ui/skeleton";

function CastRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <Skeleton className="size-12 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        {/* Name */}
        <Skeleton className="h-3.5 w-32 rounded" />
        {/* Role */}
        <Skeleton className="h-3 w-20 rounded opacity-60" />
      </div>
    </div>
  );
}

export function CastSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <section className="mx-auto block max-w-7xl items-center px-4">
      <div className="space-y-3 py-5">
        {/* Back + title skeleton */}
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-48 rounded" />
      </div>

      <div className="my-5 mb-40 grid justify-between gap-3 space-y-10 md:grid-cols-2 md:space-y-0">
        {/* Cast column */}
        <div>
          <Skeleton className="mb-5 h-7 w-16 rounded" />
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            {Array.from({ length: rows }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
              <CastRowSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Crew column */}
        <div>
          <Skeleton className="mb-5 h-7 w-16 rounded" />
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            {Array.from({ length: Math.ceil(rows * 0.7) }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder
              <CastRowSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
