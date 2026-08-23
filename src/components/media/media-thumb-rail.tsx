import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import type {
  MediaDialogKey,
  MediaDialogSearch,
} from "@/lib/media-dialog-helpers";
import { MediaLightboxDialog } from "@/components/media/media-lightbox-dialog";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import { ArrowRightLine } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { updateDialogSearch } from "@/lib/media-dialog-helpers";

interface MediaThumbRailProps<T> {
  /** Items rendered left to right; array order drives prev/next cycling. */
  items: T[];
  /** URL search param storing the active item's key so dialogs deep-link. */
  paramKey: MediaDialogKey;
  /** Stable value written to the search param for an item. */
  getKey: (item: T) => string | undefined;
  getThumbSrc: (item: T) => string;
  getThumbAlt: (item: T) => string;
  /** Full thumbnail Image classes: aspect ratio, heights, hover states. */
  imageClassName: string;
  thumbWidth?: number;
  thumbHeight?: number;
  /** Optional label badges / play overlays rendered inside the tile. */
  renderTileOverlay?: (item: T) => React.ReactNode;
  getLightboxTitle: (item: T) => string;
  lightboxOverlayClassName?: string;
  lightboxContentClassName?: string;
  /** Lightbox body rendered for the active item. */
  renderLightboxBody: (item: T) => React.ReactNode;
  /** Accessible labels for the lightbox chevrons. */
  prevLabel?: string;
  nextLabel?: string;
  /** Renders the trailing "View More" link when provided. */
  viewMoreHref?: string;
  railClassName?: string;
  scrollContainerClassName?: string;
}

/**
 * Scrollable thumbnail rail with a single search-param-driven lightbox.
 * Owns the a11y tile wrapper (role="button" + Enter/Space handling),
 * the dialog search-param wiring, and the prev/next/close index math.
 */
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
  const search = useSearch({ strict: false }) as MediaDialogSearch;

  const setActiveKey = (value?: string) =>
    updateDialogSearch(
      (options) => navigate(options as never),
      paramKey,
      value,
    );

  const activeKey = search[paramKey] as string | undefined;
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
              className="group focus-visible:ring-ring focus-visible:ring-offset-background relative cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
