import type { ReactNode } from "react";

export function SkeletonList({
  count,
  render,
  className,
}: {
  count: number;
  render: (index: number) => ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, index) => render(index))}
    </div>
  );
}
