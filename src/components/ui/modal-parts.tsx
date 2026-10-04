import type { ComponentProps, ComponentType, ReactNode } from "react";

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ModalIcon = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true";
}>;

/**
 * Shared modal layout: `ModalHeader` (icon + title + optional subtitle),
 * `ModalBody` (scrollable content) and `ModalFooter` (optional actions).
 * Use inside a `DialogPopup` with `className="flex flex-col gap-0 overflow-hidden p-0"`.
 */
export function ModalHeader({
  icon: Icon,
  title,
  subtitle,
  className,
}: {
  icon: ModalIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <DialogHeader
      className={cn(
        "shrink-0 gap-0 border-b px-5 py-4 pe-14 text-start max-sm:pb-4",
        className,
      )}
    >
      <div
        className={cn("flex gap-3", subtitle ? "items-start" : "items-center")}
      >
        <Icon
          aria-hidden="true"
          size={20}
          className={cn("text-foreground shrink-0", subtitle && "mt-0.5")}
        />
        <div className="min-w-0 space-y-0.5">
          <DialogTitle className="font-heading text-base leading-tight font-semibold sm:text-lg">
            {title}
          </DialogTitle>
          {subtitle ? (
            <DialogDescription className="text-muted-foreground text-xs leading-snug sm:text-sm">
              {subtitle}
            </DialogDescription>
          ) : null}
        </div>
      </div>
    </DialogHeader>
  );
}

export function ModalBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}
      data-slot="modal-body"
      {...props}
    />
  );
}

export function ModalFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3",
        className,
      )}
      data-slot="modal-footer"
      {...props}
    />
  );
}
