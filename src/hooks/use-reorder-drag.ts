import type React from "react";
import { useCallback, useRef, useState } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/** Cards opt into drag-to-reorder by rendering this attribute on their root. */
export const REORDER_ITEM_SELECTOR = "[data-reorder-index]";

/** Props to spread onto a drag handle element (e.g. the rank badge button). */
export interface ReorderHandleProps {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onPointerMove: React.PointerEventHandler<HTMLElement>;
  onPointerUp: React.PointerEventHandler<HTMLElement>;
  onPointerCancel: React.PointerEventHandler<HTMLElement>;
}

interface UseReorderDragOptions {
  /** The grid/container that holds the draggable items. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called on drop with the source and destination indices (visible order). */
  onReorder: (from: number, to: number) => void;
  /** Set false to make every handle inert (e.g. read-only or unfiltered views). */
  enabled?: boolean;
}

interface DragState {
  from: number;
  to: number;
  pointerId: number;
  el: HTMLElement;
  handle: HTMLElement;
  startX: number;
  startY: number;
  scrollY: number;
}

interface ItemCenter {
  index: number;
  cx: number;
  cy: number;
}

const LIFT = "translate3d(0,0,0) scale(1.06)";

/**
 * Pointer-driven drag-to-reorder for grids.
 *
 * Drag is started from an explicit handle (the rank badge) rather than the
 * whole card, so the poster's own link/scroll affordances are untouched. The
 * dragged card tracks the finger 1:1 (direct manipulation), the drop target is
 * resolved by nearest-centre hit-testing against cached rects, and the move is
 * committed once on release — never mid-gesture — so a drag can be cancelled
 * by returning to the origin.
 *
 * Keyboard users keep the existing Up/Down controls; this only adds the
 * pointer affordance.
 */
export function useReorderDrag({
  containerRef,
  onReorder,
  enabled = true,
}: UseReorderDragOptions) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const centersRef = useRef<ItemCenter[]>([]);
  // Read the latest callback at release time without making the returned handle
  // props change identity on every render (which would defeat card memoization).
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const centers: ItemCenter[] = [];
    container
      .querySelectorAll<HTMLElement>(REORDER_ITEM_SELECTOR)
      .forEach((node) => {
        const index = Number(node.dataset.reorderIndex);
        if (Number.isNaN(index)) return;
        const rect = node.getBoundingClientRect();
        centers.push({
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          index,
        });
      });
    centersRef.current = centers;
  }, [containerRef]);

  const nearestIndex = useCallback((x: number, y: number): number => {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const center of centersRef.current) {
      const dx = x - center.cx;
      const dy = y - center.cy;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = center.index;
      }
    }
    return best;
  }, []);

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>, commit = true) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setDraggingIndex(null);

      const { el } = drag;
      el.style.transition = "";
      el.style.transform = "";
      el.style.zIndex = "";
      el.style.willChange = "";
      document.body.style.cursor = "";
      if (el.hasPointerCapture?.(drag.pointerId)) {
        el.releasePointerCapture(drag.pointerId);
      }
      void event;
      if (commit && drag.to !== drag.from) {
        onReorderRef.current(drag.from, drag.to);
      }
    },
    [],
  );

  const getHandleProps = useCallback(
    (index: number): ReorderHandleProps => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (!enabled || event.button !== 0 || dragRef.current) return;
        const handle = event.currentTarget as HTMLElement;
        const el = handle.closest<HTMLElement>(REORDER_ITEM_SELECTOR);
        if (!el || !containerRef.current) return;
        event.preventDefault();

        measure();
        dragRef.current = {
          el,
          from: index,
          handle,
          pointerId: event.pointerId,
          scrollY: window.scrollY,
          startX: event.clientX,
          startY: event.clientY,
          to: index,
        };
        // Capture on the handle so the gesture survives leaving the badge.
        handle.setPointerCapture(event.pointerId);
        setDraggingIndex(index);
        el.style.willChange = "transform";
        el.style.zIndex = "50";
        if (!prefersReducedMotion()) {
          el.style.transition = "none";
        }
        el.style.transform = LIFT;
        document.body.style.cursor = "grabbing";
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;

        // Re-measure if the page scrolled under the pointer mid-drag; the
        // cached centres are viewport-relative and would otherwise drift.
        if (window.scrollY !== drag.scrollY) {
          measure();
          drag.scrollY = window.scrollY;
        }

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        drag.el.style.transform =
          Math.abs(dx) + Math.abs(dy) > 3
            ? `translate3d(${dx}px, ${dy}px, 0) scale(1.06)`
            : LIFT;

        const target = nearestIndex(event.clientX, event.clientY);
        if (target !== -1) {
          drag.to = target;
        }
      },
      onPointerUp: (event) => finish(event),
      onPointerCancel: (event) => finish(event, false),
    }),
    [containerRef, enabled, finish, measure, nearestIndex],
  );

  return { draggingIndex, getHandleProps };
}
