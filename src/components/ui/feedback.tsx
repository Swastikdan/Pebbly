import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

export function ErrorBanner({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}
