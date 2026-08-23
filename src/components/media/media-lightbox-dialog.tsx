import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-50 -translate-y-1/2 rounded-lg bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0";

/** Centered play-circle overlay shown on video thumbnails. */
export function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-[color,background-color,transform] duration-200 group-hover:scale-110">
        <Play className="size-6 fill-white text-white" />
      </div>
    </div>
  );
}

/** Sandbox-hardened autoplaying YouTube embed used by every lightbox. */
export function YouTubeEmbed({
  videoKey,
  title,
  className = "size-full rounded-xl",
}: {
  videoKey: string;
  title: string;
  className?: string;
}) {
  return (
    <iframe
      allowFullScreen
      allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      className={className}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
      src={`https://www.youtube.com/embed/${videoKey}?autoplay=1`}
      title={title}
    />
  );
}

/** Prev/next chevron overlaid inside a lightbox popup. */
export function LightboxNavButton({
  dir,
  label,
  onClick,
}: {
  dir: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={`${dir === "prev" ? "left-4" : "right-4"} ${NAV_BUTTON_CLASS}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-6" />
      ) : (
        <ChevronRight className="size-6" />
      )}
    </Button>
  );
}

interface MediaLightboxDialogProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  overlayClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export function MediaLightboxDialog({
  isOpen,
  title,
  onClose,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  overlayClassName = "bg-white/40 backdrop-blur-lg dark:bg-black/70",
  contentClassName = "aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-2xl border-0 bg-transparent p-0 ring-0 overflow-hidden",
  children,
}: MediaLightboxDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup
        overlayClassName={overlayClassName}
        className={contentClassName}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        {hasPrev && (
          <LightboxNavButton
            dir="prev"
            label="Previous item"
            onClick={onPrev}
          />
        )}
        {hasNext && (
          <LightboxNavButton dir="next" label="Next item" onClick={onNext} />
        )}
      </DialogPopup>
    </Dialog>
  );
}
