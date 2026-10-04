"use client";

import type React from "react";
import { Toast } from "@base-ui/react/toast";

import { buttonVariants } from "@/components/ui/button";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "@/components/ui/hugeicons";
import { cn } from "@/lib/utils";

const TOAST_ICONS = {
  error: CircleAlertIcon,
  info: InfoIcon,
  loading: LoaderCircleIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
} as const;

type SwipeDirection = "up" | "down" | "left" | "right";

type ToastData = {
  /** Remaining whole seconds, rendered inside the destructive countdown ring. */
  secondsLeft?: number;
  /** Total countdown length in ms (drives the ring animation). */
  duration?: number;
  rootProps?: Omit<
    React.ComponentProps<typeof Toast.Root>,
    "children" | "className" | "swipeDirection" | "toast"
  >;
};

function getSwipeDirection(position: ToastPosition): SwipeDirection[] {
  const verticalDirection: SwipeDirection = position.startsWith("top")
    ? "up"
    : "down";

  if (position.includes("center")) {
    return [verticalDirection];
  }

  if (position.includes("left")) {
    return ["left", verticalDirection];
  }

  return ["right", verticalDirection];
}

function upsertReplayClassName(toast: {
  type?: string;
  updateKey?: number;
}): string | undefined {
  const k = toast.updateKey ?? 0;
  if (k <= 0) return undefined;
  const isEven = k % 2 === 0;
  if (toast.type === "error") {
    return isEven ? "animate-toast-error-even" : "animate-toast-error-odd";
  }
  return isEven ? "animate-toast-success-even" : "animate-toast-success-odd";
}

function CountdownRing({
  seconds,
  duration,
  ending,
}: {
  seconds?: number;
  duration: number;
  /** Toast is closing: stop the ring animation so it can't delay removal. */
  ending?: boolean;
}): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="relative flex size-8 shrink-0 items-center justify-center"
      data-slot="toast-timer"
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 32 32">
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-foreground/15"
        />
        <circle
          cx="16"
          cy="16"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          className="text-foreground"
          style={{
            animation: ending
              ? "none"
              : `toast-ring ${duration}ms linear forwards`,
          }}
        />
      </svg>
      <span className="text-foreground text-xs font-semibold tabular-nums">
        {seconds ?? ""}
      </span>
    </div>
  );
}

function Toasts({
  position,
  portalProps,
}: {
  position: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}): React.ReactElement {
  const { toasts } = Toast.useToastManager();
  const swipeDirection = getSwipeDirection(position);

  return (
    <Toast.Portal data-slot="toast-portal" {...portalProps}>
      <Toast.Viewport
        className={cn(
          "fixed z-60 mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
          "data-[position*=top]:top-(--toast-inset)",
          "data-[position*=bottom]:bottom-(--toast-inset)",
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2",
        )}
        data-position={position}
        data-slot="toast-viewport"
      >
        {toasts.map((toast) => {
          const Icon = toast.type
            ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS]
            : null;
          const toastData = toast.data as ToastData | undefined;
          const isDestructive = toast.type === "destructive";
          const isEnding = toast.transitionStatus === "ending";

          return (
            <Toast.Root
              key={toast.id}
              className={cn(
                "group text-popover-foreground data-expanded:bg-popover dark:data-expanded:bg-popover absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full overflow-hidden rounded-lg border bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(1%*max(0,var(--toast-index,0))))] shadow-none select-none [transition:transform_300ms_cubic-bezier(.22,1,.36,1),opacity_300ms_cubic-bezier(.22,1,.36,1),height_150ms_ease-out,background-color_150ms_ease-out]",
                "data-[position*=right]:right-0 data-[position*=right]:left-auto",
                "data-[position*=left]:right-auto data-[position*=left]:left-0",
                "data-[position*=center]:right-0 data-[position*=center]:left-0",
                "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-[50%_calc(50%-50%*min(var(--toast-index,0),1))]",
                "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-[50%_calc(50%+50%*min(var(--toast-index,0),1))]",
                "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
                "data-[position*=top]:after:top-full",
                "data-[position*=bottom]:after:bottom-full",
                "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
                "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
                "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",
                "data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
                "data-limited:opacity-0",
                "data-expanded:h-(--toast-height)",
                "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
                "data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
                "data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
                "data-ending-style:opacity-0",
                "data-[position*=top]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(-100%-var(--toast-inset)))]",
                "data-[position*=bottom]:data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
                "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
                "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
                "data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
                "data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
                upsertReplayClassName(toast),
              )}
              {...toastData?.rootProps}
              data-position={position}
              data-slot="toast-root"
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <Toast.Content className="pointer-events-auto flex items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-250 data-behind:opacity-0 data-behind:not-data-expanded:pointer-events-none data-expanded:opacity-100">
                <div
                  className={cn(
                    "flex min-w-0 gap-2",
                    isDestructive && "items-center gap-3",
                  )}
                >
                  {isDestructive && (
                    <CountdownRing
                      seconds={toastData?.secondsLeft}
                      duration={toastData?.duration ?? 10_000}
                      ending={isEnding}
                    />
                  )}
                  {Icon && (
                    <div
                      className="[&_svg]:pointer-events-none [&_svg]:shrink-0 [&>svg]:h-lh [&>svg]:w-4"
                      data-slot="toast-icon"
                    >
                      <Icon
                        aria-hidden="true"
                        className="in-data-[type=error]:text-destructive-foreground in-data-[type=info]:text-info-foreground in-data-[type=success]:text-success-foreground in-data-[type=warning]:text-warning-foreground in-data-[type=loading]:animate-spin in-data-[type=loading]:opacity-80"
                      />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Toast.Title
                      className={cn(
                        "font-medium",
                        isDestructive &&
                          "text-foreground truncate text-sm leading-tight font-semibold",
                      )}
                      data-slot="toast-title"
                    />
                    <Toast.Description
                      className={cn(
                        "text-muted-foreground text-[11px] leading-tight",
                        isDestructive &&
                          "text-muted-foreground/80 truncate text-[11px] leading-tight",
                      )}
                      data-slot="toast-description"
                    />
                  </div>
                </div>
                {toast.actionProps && (
                  <Toast.Action
                    className={cn(
                      buttonVariants({
                        size: "xs",
                        variant: isDestructive ? "outline" : "default",
                      }),
                      isDestructive &&
                        "active:bg-accent shrink-0 transition-[transform,color,background-color,border-color,opacity] duration-150 active:scale-[0.94]",
                    )}
                    disabled={isEnding}
                    data-slot="toast-action"
                  >
                    {toast.actionProps.children}
                  </Toast.Action>
                )}
              </Toast.Content>
              {!isDestructive && toast.timeout && toast.timeout > 0 ? (
                <div
                  data-slot="toast-progress"
                  aria-hidden="true"
                  className="bg-primary/25 pointer-events-none absolute bottom-0 left-0 h-0.5 w-full origin-left overflow-hidden rounded-b-lg group-hover:[animation-play-state:paused]"
                  style={{
                    animation: `toast-progress ${toast.timeout}ms linear forwards`,
                  }}
                />
              ) : null}
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export const toastManager: ReturnType<typeof Toast.createToastManager> =
  Toast.createToastManager();

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
  portalProps?: React.ComponentProps<typeof Toast.Portal>;
}

export function ToastProvider({
  children,
  position = "bottom-right",
  portalProps,
  ...props
}: ToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      {children}
      <Toasts portalProps={portalProps} position={position} />
    </Toast.Provider>
  );
}

export { Toast as ToastPrimitive };
