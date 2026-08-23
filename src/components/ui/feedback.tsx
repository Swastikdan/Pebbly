import { Skeleton } from "@/components/ui/skeleton";

/** Row of loading placeholders for horizontal media rails/grids. */
export function SkeletonGrid({
  count,
  itemClassName,
}: {
  count: number;
  itemClassName: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
          key={index}
          className={itemClassName}
        />
      ))}
    </>
  );
}

/** Destructive inline notice shared by admin surfaces. */
export function ErrorBanner({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-3 text-xs ${className}`}
    >
      {children}
    </div>
  );
}
