import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";

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

export function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-black/60 transition-[color,background-color,transform] duration-200 [@media(hover:hover)]:group-hover:scale-110">
        <Play className="size-6 fill-white text-white" />
      </div>
    </div>
  );
}

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
  prevLabel?: string;
  nextLabel?: string;
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
  overlayClassName = "bg-black/50 backdrop-blur-sm",
  contentClassName = "aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-lg border-0  p-0 ring-0 overflow-hidden",
  prevLabel = "Previous item",
  nextLabel = "Next item",
  children,
}: MediaLightboxDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && hasPrev) {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight" && hasNext) {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrev, isOpen, onNext, onPrev]);

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
          <LightboxNavButton dir="prev" label={prevLabel} onClick={onPrev} />
        )}
        {hasNext && (
          <LightboxNavButton dir="next" label={nextLabel} onClick={onNext} />
        )}
      </DialogPopup>
    </Dialog>
  );
}
