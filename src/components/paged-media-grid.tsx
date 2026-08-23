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
      <div className="flex min-h-96 w-full items-center justify-center">
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
          error
        ) : showEmpty && empty ? (
          empty
        ) : (
          <MediaGrid stagger>{children}</MediaGrid>
        )}
      </div>
      {footer}
    </section>
  );
}
