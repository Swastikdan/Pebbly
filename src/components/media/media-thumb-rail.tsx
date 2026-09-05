import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import type { MediaDialogKey } from "@/lib/media-dialog-helpers";
import { MediaLightboxDialog } from "@/components/media/media-lightbox-dialog";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { ArrowRightLine } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { updateDialogSearch } from "@/lib/media-dialog-helpers";

interface MediaThumbRailProps<T> {
  items: T[];
  paramKey: MediaDialogKey;
  getKey: (item: T) => string | undefined;
  getThumbSrc: (item: T) => string;
  getThumbAlt: (item: T) => string;
  imageClassName: string;
  thumbWidth?: number;
  thumbHeight?: number;
  renderTileOverlay?: (item: T) => React.ReactNode;
  getLightboxTitle: (item: T) => string;
  lightboxOverlayClassName?: string;
  lightboxContentClassName?: string;
  renderLightboxBody: (item: T) => React.ReactNode;
  prevLabel?: string;
  nextLabel?: string;
  viewMoreHref?: string;
  railClassName?: string;
  scrollContainerClassName?: string;
}

export function MediaThumbRail<T>({
  items,
  paramKey,
  getKey,
  getThumbSrc,
  getThumbAlt,
  imageClassName,
  thumbWidth = 300,
  thumbHeight = 450,
  renderTileOverlay,
  getLightboxTitle,
  lightboxOverlayClassName,
  lightboxContentClassName,
  renderLightboxBody,
  prevLabel = "Previous item",
  nextLabel = "Next item",
  viewMoreHref,
  railClassName = "flex items-center justify-center gap-3",
  scrollContainerClassName,
}: MediaThumbRailProps<T>) {
  const navigate = useNavigate();
  const activeKey = useSearch({
    strict: false,
    select: (s: Record<string, unknown>) =>
      typeof s[paramKey] === "string" ? (s[paramKey] as string) : undefined,
  });

  const setActiveKey = (value?: string) => {
    updateDialogSearch(navigate, paramKey, value);
  };

  const activeIndex = items.findIndex((item) => getKey(item) === activeKey);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  return (
    <ScrollContainer className={scrollContainerClassName}>
      <div className={railClassName}>
        {items.map((item) => {
          const itemKey = getKey(item);
          if (!itemKey) return null;
          return (
            // biome-ignore lint/a11y/useSemanticElements: contains nested <button>, cannot use <button> wrapper
            <div
              key={itemKey}
              className="group focus-visible:ring-ring focus-visible:ring-offset-background relative cursor-pointer rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2"
              role="button"
              tabIndex={0}
              onClick={() => setActiveKey(itemKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveKey(itemKey);
                }
              }}
            >
              <Image
                alt={getThumbAlt(item)}
                className={imageClassName}
                height={thumbHeight}
                src={getThumbSrc(item)}
                width={thumbWidth}
              />
              {renderTileOverlay?.(item)}
            </div>
          );
        })}
        <MediaLightboxDialog
          isOpen={!!activeItem}
          title={activeItem ? getLightboxTitle(activeItem) : ""}
          onClose={() => setActiveKey(undefined)}
          hasPrev={activeIndex > 0}
          hasNext={activeIndex >= 0 && activeIndex < items.length - 1}
          onPrev={() =>
            activeItem && setActiveKey(getKey(items[activeIndex - 1]))
          }
          onNext={() =>
            activeItem && setActiveKey(getKey(items[activeIndex + 1]))
          }
          overlayClassName={lightboxOverlayClassName}
          contentClassName={lightboxContentClassName}
          prevLabel={prevLabel}
          nextLabel={nextLabel}
        >
          {activeItem && renderLightboxBody(activeItem)}
        </MediaLightboxDialog>
        {viewMoreHref && (
          <Link to={viewMoreHref}>
            <Button
              className="pressable mr-10 ml-5 flex items-center justify-center rounded-lg"
              size="lg"
              variant="secondary"
            >
              View More
              <ArrowRightLine size={24} />
            </Button>
          </Link>
        )}
      </div>
    </ScrollContainer>
  );
}
