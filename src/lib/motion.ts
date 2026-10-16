import type { Transition } from "motion/react";

/**
 * Apple's fluid-interface spring presets (WWDC 2018 "Designing Fluid
 * Interfaces"), expressed in Motion's `bounce` + `duration` terms.
 *
 * Apple thinks in terms of a *damping ratio* (overshoot) and a *response*
 * (settle speed), not mass/stiffness/damping. Motion's `bounce` maps to the
 * damping ratio (`bounce: 0` ≈ damping 1.0, critically damped, no overshoot;
 * `bounce: 0.2` ≈ damping ~0.8) and `duration` maps closely to Apple's
 * response. A spring has no fixed duration — the settle time emerges from
 * these two values.
 *
 * Rule of thumb: use `move` (no overshoot) for anything the user did not
 * throw. Reserve `sheet` / `flick` (light overshoot) for gestures that
 * carried momentum at release, where a little bounce reads as physical.
 */
export const spring: Record<"move" | "sheet" | "flick", Transition> = {
  /** Critically damped, no overshoot. The house default. */
  move: { type: "spring", bounce: 0, duration: 0.4 },
  /** Drawer / sheet settle, and momentum-driven flicks (damping ≈ 0.8). */
  sheet: { type: "spring", bounce: 0.2, duration: 0.4 },
  flick: { type: "spring", bounce: 0.2, duration: 0.4 },
};

/**
 * Apple's momentum projection (from the "Designing Fluid Interfaces" sample
 * code). Given a release velocity in px/s, returns the additional distance the
 * gesture is *going* to travel before it rests — the same exponential-decay
 * model behind UIScrollView deceleration. Snap to the target nearest
 * `current + project(velocity)`, not the point the finger lifted.
 *
 * @param decelerationRate 0.998 for a normal scroll feel, 0.99 for snappier.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return (velocity / 1000) * (decelerationRate / (1 - decelerationRate));
}

/**
 * Progressive resistance past a boundary. The further past the edge the user
 * drags, the less the element follows — real things slow before they stop.
 * A hard stop reads as frozen; continuous resistance reads as responsive.
 *
 * @param overshoot Distance dragged past the boundary, in px.
 * @param dimension Size of the axis being dragged along, in px.
 */
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55,
): number {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

/** Whether the user has asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
