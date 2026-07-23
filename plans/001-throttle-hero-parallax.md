# 001 — Throttle the hero mouse-parallax to avoid forced layout every mousemove

- **Status**: DONE
- **Commit**: d5b17a6
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file (`src/components/LandingScreen.tsx`), ~15 lines changed

## Problem

The landing page's hero has a mouse-parallax effect: as the cursor moves over
`.ld-hero`, four background domino tiles drift slightly via CSS custom
properties `--px`/`--py`. The handler runs on every native `mousemove` event
(can fire 60-120+ times/second) and, on every single call, reads
`getBoundingClientRect()` — which forces the browser to flush any pending
layout changes synchronously before it can answer. This is a **forced
synchronous layout** on the hottest possible event, on the very first page
a visitor sees.

Current code, `src/components/LandingScreen.tsx:61-74`:

```tsx
const sceneRef = useRef<HTMLDivElement>(null);
const onMove = useCallback((e: React.MouseEvent) => {
  const el = sceneRef.current;
  if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
  el.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
}, []);
const onLeave = useCallback(() => {
  const el = sceneRef.current;
  if (!el) return;
  el.style.setProperty('--px', '0');
  el.style.setProperty('--py', '0');
}, []);
```

Wired up at `src/components/LandingScreen.tsx:97`:

```tsx
<section className="ld-hero" ref={sceneRef} onMouseMove={onMove} onMouseLeave={onLeave}>
```

Two compounding problems:

1. `getBoundingClientRect()` runs unconditionally on every `mousemove` call — the rect essentially never changes during a mouse-move-over-a-static-hero interaction, so recomputing it every time is pure waste (and the forced layout is the expensive part, not the math).
2. There's no throttling at all — the handler runs at native event frequency, not display frequency. Only one `--px`/`--py` write per animation frame is ever visually useful; everything beyond that is wasted main-thread work competing with paint/composite on a page that also has 3 looping CSS animations (`ldRise` cascade, `ldPlay`, `ldBubble` — see `src/landing.css:318,344`).

This matters more here than almost anywhere else in the app: this is the
public landing page, unauthenticated, first paint, on every kind of device
(including whatever old Android phone or budget laptop a new visitor is
holding) — jank here directly costs the "Jugar gratis ahora" conversion this
page exists for.

## Target

- Cache the hero's bounding rect **once**, on `mouseenter` (or lazily on the
  first `mousemove` of a hover session) — not on every `mousemove`.
- Rate-limit the actual style write to once per animation frame with
  `requestAnimationFrame`, storing the latest pointer position in a ref and
  only committing it in the rAF callback (a standard rAF-throttle / "latest
  wins" pattern — do not queue multiple frames).
- Keep the exact same visual output: same `--px`/`--py` formula, same 3-value
  fixed-point strings, same reset-to-`'0'` on mouse leave.
- Do not introduce a new dependency (no lodash `throttle`, no rAF library) —
  plain `useRef` + `requestAnimationFrame` is enough and matches how the rest
  of this file already uses refs.

Target code shape (adapt names/formatting to match the file, but the
structure below is required):

```tsx
const sceneRef = useRef<HTMLDivElement>(null);
const rectRef = useRef<DOMRect | null>(null);
const rafRef = useRef<number | null>(null);
const posRef = useRef({ x: 0, y: 0 });

const applyParallax = useCallback(() => {
  rafRef.current = null;
  const el = sceneRef.current;
  const rect = rectRef.current;
  if (!el || !rect) return;
  const { x, y } = posRef.current;
  el.style.setProperty('--px', ((x - rect.left) / rect.width - 0.5).toFixed(3));
  el.style.setProperty('--py', ((y - rect.top) / rect.height - 0.5).toFixed(3));
}, []);

const onEnter = useCallback(() => {
  rectRef.current = sceneRef.current?.getBoundingClientRect() ?? null;
}, []);

const onMove = useCallback((e: React.MouseEvent) => {
  posRef.current = { x: e.clientX, y: e.clientY };
  if (rafRef.current === null) {
    rafRef.current = requestAnimationFrame(applyParallax);
  }
}, [applyParallax]);

const onLeave = useCallback(() => {
  if (rafRef.current !== null) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }
  const el = sceneRef.current;
  if (!el) return;
  el.style.setProperty('--px', '0');
  el.style.setProperty('--py', '0');
}, []);
```

Wire `onMouseEnter={onEnter}` alongside the existing `onMouseMove`/`onMouseLeave`
on the `<section className="ld-hero" ...>` element.

## Repo conventions to follow

- The file already uses `useRef` + `useCallback` for this exact feature — keep
  that idiom, just add the rAF/rect-cache refs alongside `sceneRef`.
- No motion library is used anywhere in this component or `landing.css`; stay
  CSS-variable-driven — do not switch this to Framer Motion or any JS
  animation library. The CSS side (`src/landing.css:631-636`, the
  `(pointer: fine)` media query that reads `--px`/`--py`) does not change.
- Imports at the top of the file (`src/components/LandingScreen.tsx:1`) already
  import `useRef, useCallback` from `react` — no new import needed for the
  rAF approach (`requestAnimationFrame`/`cancelAnimationFrame` are globals).

## Steps

1. In `src/components/LandingScreen.tsx`, replace the `onMove`/`onLeave`
   block (lines 61-74) with the four refs + three callbacks (`onEnter`,
   `applyParallax`, `onMove`, `onLeave`) shown in Target above.
2. Update the hero `<section>` (line 97) to add `onMouseEnter={onEnter}`
   next to the existing `ref={sceneRef} onMouseMove={onMove}
   onMouseLeave={onLeave}`.
3. Double-check no other file reads `sceneRef`, `onMove`, or `onLeave` from
   this component (it's a local-only hero effect) — nothing else to update.

## Boundaries

- Do NOT touch `src/landing.css` — the CSS side of the parallax (the
  `(pointer: fine)` block reading `--px`/`--py`, `src/landing.css:631-636`)
  is correct as-is and out of scope.
- Do NOT touch any other section of `LandingScreen.tsx` (hero copy, other
  sections, footer).
- Do NOT add a throttle/debounce npm dependency.
- Do NOT change the parallax math (the `(coord - rect.edge) / rect.size - 0.5`
  formula) or the `.toFixed(3)` precision — only change *when* it runs and
  *how often* the rect is read.
- If the current code at lines 61-74 or 97 has drifted from what's quoted
  above (e.g. someone already refactored this), STOP and report instead of
  improvising.

## Verification

- **Mechanical**: `npx tsc --noEmit` in the repo root — expect no new errors.
  Run the dev server (`npm run dev`) and load `/landing` — expect no console
  errors.
- **Feel check**:
  - Open DevTools → Performance panel, record ~3 seconds of fast mouse
    movement back and forth across the hero, stop recording. Expect **no
    "Forced reflow" / "Layout" purple warnings** attributable to the
    `mousemove` handler (there will still be an initial rect read on
    `mouseenter`, which is expected and fine).
  - Confirm the tiles (`.ld-htile-1..4`) still visually drift smoothly
    following the cursor — same feel as before, just cheaper.
  - Move the mouse very fast in tight circles: the drift should track
    smoothly with no visible stutter, and should not "fall behind" the
    cursor by more than one frame.
  - Move the mouse off the hero (`mouseleave`): tiles snap back to their
    resting rotation (no `--px`/`--py` offset) — same as before.
  - In DevTools → Rendering panel, throttle CPU 4x (or 6x) and repeat the
    fast-movement test: it should stay smooth where the un-throttled version
    would visibly stutter.
- **Done when**: the parallax is visually identical to before, but the
  Performance recording shows zero forced-layout warnings during
  `mousemove`, and the style write happens at most once per animation frame
  regardless of how many `mousemove` events fire in that frame.
