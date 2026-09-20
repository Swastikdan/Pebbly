import { Skeleton } from "@/components/ui/skeleton";

// Shown while the detail route loader prefetches full details, so a slow
// navigation reads as a loading page instead of a blank full-screen spinner.
export function MediaDetailSkeleton() {
  return (
    <section
      aria-label="Loading content"
      aria-busy="true"
      className="mx-auto block min-h-dvh max-w-7xl px-4 md:min-h-[calc(100dvh-5rem)]"
    >
      <div className="pt-5 pb-4">
        <div className="space-y-3 pb-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="size-9 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-3/4 rounded-md" />
          <Skeleton className="h-5 w-1/2 rounded-md" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <Skeleton className="aspect-video w-full rounded-xl" />
    </section>
  );
}
