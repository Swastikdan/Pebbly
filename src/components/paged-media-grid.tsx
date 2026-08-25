import type { ReactNode } from "react";

import { MediaCardSkeleton } from "@/components/media-card";
import { MediaGrid } from "@/components/ui/media-grid";

interface PagedMediaGridProps {
  isLoading: boolean;
  showError?: boolean;
  error?: ReactNode;
  showEmpty?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function PagedMediaGrid({
  isLoading,
  showError = false,
  error,
  showEmpty = false,
  empty,
  footer,
  children,
}: PagedMediaGridProps) {
  return (
    <section className="flex h-full flex-col">
      <div className="flex min-h-[420px] w-full items-center justify-center">
        {isLoading ? (
          <section className="flex h-full w-full flex-col">
            <MediaGrid>
              {Array.from({ length: 12 }).map((_, index) => (
                <MediaCardSkeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
                  key={index}
                  card_type="horizontal"
                />
              ))}
            </MediaGrid>
          </section>
        ) : showError && error ? (
          <div className="flex min-h-[320px] w-full items-center justify-center">
            {error}
          </div>
        ) : showEmpty && empty ? (
          <div className="flex min-h-[320px] w-full items-center justify-center">
            {empty}
          </div>
        ) : (
          <MediaGrid stagger>{children}</MediaGrid>
        )}
      </div>
      <div className="min-h-[56px]">{footer}</div>
    </section>
  );
}
