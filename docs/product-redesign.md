# Pebb Product Redesign

## 1. UI/UX Audit

### What works

- Broad discovery coverage, useful watch progress, responsive media cards, URL-addressable media dialogs, and reusable Radix primitives provide a strong base.
- Skip navigation, semantic labels, focus styles, image sizing, preconnects, and query preloading show good accessibility and performance intent.
- The watchlist already supports meaningful states, filters, reactions, sorting, import, and export.

### Primary issues

- **Hierarchy:** Most pages use similar weights, neutral surfaces, and spacing. Page title, primary action, context, and supporting modules do not separate strongly enough.
- **System consistency:** Radius, overlay, shadow, hover, and button treatments are repeatedly specified at call sites. Similar controls consequently feel different.
- **Navigation:** Desktop discovery is hidden in dropdowns and mobile navigation is a long sheet. Search, watchlist, and current location should be the stable anchors.
- **Discovery:** Horizontal rails are good for scanning but weak for comparison and orientation. Filters need persistent summaries, removable chips, result counts, and URL state.
- **Cards:** Metadata is legible but actions visually compete with artwork. Hover-only affordances need equal keyboard and touch behavior.
- **Details:** Media, cast, seasons, keywords, and recommendations are individually useful, but the hero should prioritize title, essential facts, synopsis, primary watchlist CTA, and progress before secondary modules.
- **Feedback:** Full-page route loading loses context. Watchlist and progress actions need optimistic state, polite announcements, and recoverable errors.
- **Motion:** Several independent animation utilities use different timing. Staggered entrance animation can delay comprehension and does not scale well to large result sets.
- **Dark theme:** The prior near-neutral grays lacked surface separation and a recognizable focus/accent color.
- **Mobile:** Some visual controls are 32-36px even though pseudo-elements expand their hit area. Visible control bounds should generally reach 44px for primary actions.

## 2. Design System Specification

### Character

"Editorial cinema, precision software": quiet blue-black surfaces, sharp information design, poster-led color, and restrained blue focus/accent. Artwork supplies drama; chrome stays calm.

### Typography

- Display: Bricolage Grotesque, `32/36` mobile to `56/58` desktop, weight 650-750.
- Heading 1: `32/38`, 700. Heading 2: `24/30`, 650. Heading 3: `18/24`, 650.
- Body: `15/24`, 400-500. Compact UI: `13/18`, 550-650. Label: `11/16`, 650, `0.06em` tracking.
- Use tabular numbers for ratings, dates, runtimes, and progress.

### Spacing and geometry

- Base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px.
- Page gutter: 16px mobile, 24px tablet, 32px desktop. Content width: 1280px.
- Radius: 8px controls, 12px cards, 16px panels, 20px hero/modal.

### Color and surfaces

- Background: blue-black `oklch(0.13 0.009 265)` in dark mode.
- Surface 1/2/3: `0.155`, `0.185`, and `0.225` lightness for progressive elevation.
- Text: foreground, muted foreground, then disabled at roughly 45% opacity.
- Accent/focus: blue `oklch(0.70 0.15 255)`. Semantic success, warning, destructive remain distinct and are never color-only.
- Pull ambient color from backdrop artwork only inside detail heroes; do not make it a global gradient motif.

### Elevation

- Level 0: page background, no shadow.
- Level 1: card, one-pixel highlight/border and small shadow.
- Level 2: menus/sticky controls, border plus `0 8px 24px rgb(0 0 0 / .20)`.
- Level 3: dialogs, stronger occlusion shadow plus a restrained backdrop blur.

## 3. Component Redesign Plan

- **Header:** Persistent logo, Movies, TV, Search, and Watchlist. Use active route state; move low-frequency items into one account/product menu. Collapse to logo, search, and bottom navigation on mobile.
- **Search:** Command-style field with shortcut hint, recent searches, grouped movie/TV/person suggestions, clear button, and explicit loading/no-results states. Keep the submitted query in the URL.
- **Buttons:** Primary, secondary, outline, ghost, destructive, and icon variants share tactile inset highlight, 150ms feedback, three-pixel focus halo, pressed translation, and disabled semantics.
- **Cards:** Maintain fixed image aspect ratios, use one metadata row, reveal secondary action on hover/focus, keep watchlist action permanently visible on touch, and expose an accessible action name.
- **Inputs:** Persistent label, optional description, 40-44px height, visible error icon/text, and no placeholder-only labeling.
- **Menus:** 8px internal padding, 36px rows, selected/check state, collision-aware placement, 120ms opacity/scale transition.
- **Tabs:** Use tabs only for alternate views of the same context. Use links for navigable detail subpages so browser history and deep linking remain truthful.
- **Dialogs/sheets:** One title, clear close control, focus trap, focus return, safe-area padding, and bottom sheet behavior below 640px.
- **Toasts:** Bottom-right desktop and above bottom nav mobile; announce success politely, errors assertively; include Undo for watchlist removal.
- **Skeletons:** Match final geometry exactly. Animate one low-contrast shimmer only when motion is allowed.
- **Homepage:** One editorial feature hero, Continue Watching for returning users, then rails grouped by intent rather than data source.
- **Watchlist:** Status segmented control with counts, compact filter bar, grid/list toggle, bulk edit mode, optimistic progress changes, and contextual empty states.
- **Details:** Backdrop and poster compose one hero. Put watchlist/progress and trailer CTAs next to the title. Follow with synopsis/facts, seasons, cast, media, then related titles.

## 4. Accessibility Improvements

- Preserve the skip link and logical landmarks; add a single visible `h1` per route.
- Ensure every icon button has an accessible name and every decorative icon has `aria-hidden`.
- Use actual links for navigation and buttons for mutations/dialogs; never nest interactive elements.
- Keep focus visible against every surface and restore focus after dialog/sheet closure.
- Announce optimistic watchlist/progress outcomes with a shared `aria-live="polite"` region.
- Add error summaries for forms and associate messages via `aria-describedby`.
- Meet WCAG 2.2 AA contrast, 24px minimum pointer targets, and 44px preferred primary touch targets.
- Test at 200% zoom, keyboard only, VoiceOver/Safari, NVDA/Firefox, and Windows High Contrast.

## 5. Motion Design Strategy

- Standard timings: 100ms press, 140ms hover, 180ms route/menu, 220ms modal. Use `cubic-bezier(.2,.8,.2,1)` for entrances.
- Animate only opacity and transform; avoid height, top, and box-shadow animation on repeated card grids.
- Use motion to explain state: watchlist confirmation, filter application, dialog origin, and route continuity.
- Do not stagger more than the first six above-fold cards. Never replay list entrances after filters.
- The global reduced-motion rule removes decorative movement, shimmer, scaling, and route animation while retaining immediate state changes.

## 6. TanStack Router View Transition Strategy

- `defaultViewTransition: true` enables progressive route transitions; unsupported browsers retain normal navigation.
- Root route transitions use a 180ms crossfade with a four-pixel incoming offset. Reduced motion disables the animation.
- Give a clicked poster and the detail poster a stable `view-transition-name: media-{type}-{id}` only during navigation. Names must be unique in the rendered tree.
- Keep the shell/header outside the transitioning content when using named groups to prevent navigation flash.
- Search query changes should transition the results container, not the search input. Watchlist mutations should animate locally and should not invoke a document transition.
- Detail tabs implemented as routes may crossfade their content region. Back navigation should not reverse or exaggerate motion.

Example named poster styling:

```tsx
<Link
  to={`/${mediaType}/${id}/${slug}`}
  viewTransition={{ types: ['media-detail'] }}
  onClick={() => document.documentElement.style.setProperty('--active-media-id', `${mediaType}-${id}`)}
>
  <Image style={{ viewTransitionName: `media-${mediaType}-${id}` }} {...imageProps} />
</Link>
```

Use this only after confirming the installed router API and ensuring duplicate carousel cards do not share a name.

## 7. Mobile UX Improvements

- Add a four-item bottom bar: Home, Search, Watchlist, Profile. Hide it while a sheet, modal, or player is open.
- Use a full-screen search route with autofocus only after explicit user action; keep recent searches locally.
- Show two poster columns with 12px gaps; use horizontal rails only for Continue Watching and editorial collections.
- Place the primary detail CTA in a sticky safe-area action dock after the hero scrolls away.
- Convert dense filter popovers into a bottom sheet with Apply and Reset actions and a visible active-filter count.
- Use disclosure for secondary facts, reduce repeated metadata, and preserve scroll position across detail subroutes.

## 8. Tailwind Implementation Examples

```tsx
<section className="mx-auto w-full max-w-screen-xl px-4 py-8 md:px-6 lg:px-8">
  <header className="mb-5 flex items-end justify-between gap-4">
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">Because you watched Dune</p>
      <h2 className="text-2xl font-semibold tracking-[-.025em]">Vast worlds</h2>
    </div>
  </header>
</section>
```

```tsx
<div className="rounded-xl border border-white/[.07] bg-card shadow-[0_1px_0_rgb(255_255_255/.05)_inset,0_8px_24px_rgb(0_0_0/.18)]">
  {/* Layered surface content */}
</div>
```

## 9. Prioritized Refactoring Roadmap

1. **Foundation:** tokens, buttons, focus, reduced motion, route transitions, and exact-shape skeletons. Done in the initial redesign pass except skeleton coverage.
2. **Shell:** simplify desktop header, implement active states and mobile bottom navigation, then rebuild search entry/suggestions.
3. **Core content:** consolidate card variants, standardize section headers/rails, and redesign homepage and result grids.
4. **High-value workflows:** rebuild detail hero, optimistic watchlist/progress feedback, filters, empty/error states, and mobile action dock.
5. **Continuity:** add collision-safe named poster transitions and route-specific transition groups.
6. **Validation:** automated accessibility checks, keyboard and screen-reader passes, visual regression baselines, and Core Web Vitals budgets.

Acceptance budgets: LCP under 2.5s at p75, CLS under 0.1, INP under 200ms, no new animation dependency, and no route-level spinner when cached content is available.

## 10. Key Component Example

The production button in `src/components/ui/button.tsx` is the reference implementation. It centralizes variants, uses border and inset-light depth instead of large shadows, has consistent press/focus/disabled states, and removes movement for reduced-motion users. New controls should compose this primitive instead of restyling buttons at call sites.
