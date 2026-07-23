# 003 — Scroll-reveal the 7 below-fold landing sections, with stagger on the mode-card grid and rank strip

- **Status**: DONE
- **Commit**: d5b17a6
- **Severity**: LOW (severity label per template; impact is high — see rationale)
- **Category**: Missed opportunities (Opportunity A + B from the audit) / Cohesion
- **Estimated scope**: 3 files — 1 new hook (`src/hooks/useReveal.ts`), `src/components/LandingScreen.tsx`, `src/landing.css`

## Problem

The landing page's hero has a polished entrance (`.ld-hero-content > *` rises
in with a staggered `ldRise` keyframe, `src/landing.css:619-629`), but
**everything below the hero just sits there** as the visitor scrolls — the
demo table, the 3 mode cards, the rules panel, the 5-rank progression strip,
the tournaments callout, the social proof section, and the final CTA all
appear fully-formed with no motion, regardless of scroll position.

This is a marketing landing page (`AUDIT.md` §1: "Marketing / explanatory"
duration budgets can be longer than UI; personality is playful/warm, not a
crisp dashboard) — scroll-reveal on content sections is the single highest-
leverage "missed opportunity" motion pattern for a page whose only job is to
sell the product as the visitor scrolls through it. Two concrete gaps:

1. **No section-level reveal.** The 7 `<section>` elements below the hero
   (`src/components/LandingScreen.tsx:129,170,207,251,273,291,329` — classes
   `.ld-demo`, `.ld-modes`, `.ld-rules`, `.ld-ranks`, `.ld-torneos`,
   `.ld-social`, `.ld-final-cta`) render with no entrance animation at all.
2. **No stagger on the two obvious list-like groups.** The 3-card mode grid
   (`.ld-mode-row` at `src/components/LandingScreen.tsx:186`, 3
   `.ld-mode-card` children) and the 5-item rank progression strip
   (`.ld-ranks-strip` at `src/components/LandingScreen.tsx:258`, `.ld-rank`
   children) both narrate something sequential (game modes to pick from,
   rank-by-rank climb) that a stagger would visually reinforce — currently
   they pop in all at once as part of their parent, same as everything else.

There is no existing scroll-triggered reveal mechanism anywhere in this
codebase (`src/hooks/` has no IntersectionObserver-based hook yet) — this
plan introduces the first one, deliberately modeled on the existing
`useMeasuredWidth` hook's callback-ref pattern (see Repo conventions below).

## Target

**A new hook**, `src/hooks/useReveal.ts`, callback-ref based (matching
`src/hooks/useMeasuredWidth.ts`'s exact shape), using `IntersectionObserver`,
disconnecting after the first reveal (entrance animations must not repeat
on re-scroll):

```ts
import { useCallback, useRef, useState } from 'react';

/**
 * Revela un elemento con una animación cuando entra en el viewport
 * (scroll-reveal). Callback ref, mismo patrón que useMeasuredWidth. Se
 * desconecta tras la primera intersección — la entrada no debe repetirse
 * si el usuario vuelve a scrollear sobre la sección.
 */
export function useReveal(): [boolean, (el: HTMLElement | null) => void] {
  const [visible, setVisible] = useState(false);
  const ioRef = useRef<IntersectionObserver | null>(null);

  const refCb = useCallback((el: HTMLElement | null) => {
    ioRef.current?.disconnect();
    ioRef.current = null;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    ioRef.current = io;
  }, []);

  return [visible, refCb];
}
```

**CSS**, appended to `src/landing.css` in the existing `/* ── Motion ── */`
block (after line 637, right after the existing hero parallax media query,
before the `/* ── Responsive ── */` block at line 639):

```css
/* ── Scroll-reveal (secciones bajo el hero) ─────────
   Mismo keyframe ldRise que ya usa el hero (arriba) — misma curva y
   personalidad, solo disparado por scroll en vez de por mount. */
.ld-reveal { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .ld-reveal.is-visible {
    animation: ldRise .6s cubic-bezier(.2, .7, .2, 1) both;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ld-reveal { opacity: 1; }
}

/* Stagger: modos de juego (3 cards) — narran una secuencia de opciones */
.ld-mode-row .ld-mode-card { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .ld-modes.is-visible .ld-mode-row .ld-mode-card {
    animation: ldRise .5s cubic-bezier(.2, .7, .2, 1) both;
  }
  .ld-modes.is-visible .ld-mode-row .ld-mode-card:nth-child(1) { animation-delay: .05s; }
  .ld-modes.is-visible .ld-mode-row .ld-mode-card:nth-child(2) { animation-delay: .11s; }
  .ld-modes.is-visible .ld-mode-row .ld-mode-card:nth-child(3) { animation-delay: .17s; }
}
@media (prefers-reduced-motion: reduce) {
  .ld-mode-row .ld-mode-card { opacity: 1; }
}

/* Stagger: progresión de rangos (5 items) — narran una escalera */
.ld-ranks-strip .ld-rank { opacity: 0; }
@media (prefers-reduced-motion: no-preference) {
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank {
    animation: ldRise .5s cubic-bezier(.2, .7, .2, 1) both;
  }
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank:nth-child(1) { animation-delay: .05s; }
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank:nth-child(2) { animation-delay: .11s; }
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank:nth-child(3) { animation-delay: .17s; }
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank:nth-child(4) { animation-delay: .23s; }
  .ld-ranks.is-visible .ld-ranks-strip .ld-rank:nth-child(5) { animation-delay: .29s; }
}
@media (prefers-reduced-motion: reduce) {
  .ld-ranks-strip .ld-rank { opacity: 1; }
}
```

**JSX wiring** in `src/components/LandingScreen.tsx` — import the hook, call
it once per section (7 calls, unconditional, same order every render — legal
hook usage), add the ref + conditional `is-visible` class to each
`<section>`. Pattern for every section (shown once, repeat for all 7):

```tsx
// current (src/components/LandingScreen.tsx:129)
<section className="ld-demo">

// target
<section className={`ld-demo ld-reveal${demoVisible ? ' is-visible' : ''}`} ref={demoRef}>
```

## Repo conventions to follow

- **Exemplar to imitate exactly**: `src/hooks/useMeasuredWidth.ts` — callback-
  ref hook, `useCallback` wrapping the ref function, disconnect-previous-then-
  reconnect-new pattern, tuple return `[value, refCallback]`, Spanish JSDoc
  comment above the export. `useReveal` must follow this shape 1:1 (adapted
  for `IntersectionObserver` instead of `ResizeObserver`, and boolean instead
  of number).
- Hooks live in `src/hooks/` (see `usePoll.ts`, `useSalaChat.ts`,
  `useSocialSocket.ts`, `useMeasuredWidth.ts` already there) — put the new
  file there, not inline in the component.
- Reduced-motion handling in this file already uses the
  `@media (prefers-reduced-motion: no-preference)` / gate-the-animation-not-
  the-feature pattern (`src/landing.css:623` for the hero, `376` for the demo
  loop) — the new rules follow the identical structure, not a JS
  `useReducedMotion()` branch (there is no such hook in this codebase; don't
  introduce one).
- Reuse the existing `ldRise` `@keyframes` (`src/landing.css:619-622`) instead
  of defining a new keyframe — same easing curve `cubic-bezier(.2, .7, .2, 1)`
  already used for the hero stagger and for `.ld-htile`/`.ld-art-tile`
  transitions (`src/landing.css:139,579`), keeping this page's motion
  vocabulary to one curve.
- Stagger delays follow the audit's 30–80ms-per-item guidance and match the
  hero's own existing cascade pattern exactly (`src/landing.css:625-629`
  uses `.04s, .09s, .14s, .19s, .24s` — 50ms steps); this plan uses the same
  ~60ms step (`.05s, .11s, .17s, ...`) for consistency.

## Steps

1. Create `src/hooks/useReveal.ts` with the exact content shown in Target.
2. In `src/components/LandingScreen.tsx`, add the import:
   `import { useReveal } from '../hooks/useReveal';` alongside the existing
   imports at the top of the file (after line 2, `import { useNavigate }...`).
3. Inside `export default function LandingScreen(...)`, right after the
   existing `const navigate = useNavigate();` (line 58) and before the
   `sceneRef`/parallax code, add 7 hook calls, one per section, in this
   fixed order (top-to-bottom matching the JSX):
   ```tsx
   const [demoVisible, demoRef] = useReveal();
   const [modesVisible, modesRef] = useReveal();
   const [rulesVisible, rulesRef] = useReveal();
   const [ranksVisible, ranksRef] = useReveal();
   const [torneosVisible, torneosRef] = useReveal();
   const [socialVisible, socialRef] = useReveal();
   const [finalCtaVisible, finalCtaRef] = useReveal();
   ```
4. Update the 7 section tags to add the `ld-reveal`/`is-visible` class and
   the matching ref, one edit per section:
   - Line 129: `<section className="ld-demo">` → `<section className={`ld-demo ld-reveal${demoVisible ? ' is-visible' : ''}`} ref={demoRef}>`
   - Line 170: `<section className="ld-modes">` → `<section className={`ld-modes ld-reveal${modesVisible ? ' is-visible' : ''}`} ref={modesRef}>`
   - Line 207: `<section className="ld-rules">` → `<section className={`ld-rules ld-reveal${rulesVisible ? ' is-visible' : ''}`} ref={rulesRef}>`
   - Line 251: `<section id="ld-ranks" className="ld-ranks">` → `<section id="ld-ranks" className={`ld-ranks ld-reveal${ranksVisible ? ' is-visible' : ''}`} ref={ranksRef}>`
   - Line 273: `<section className="ld-torneos">` → `<section className={`ld-torneos ld-reveal${torneosVisible ? ' is-visible' : ''}`} ref={torneosRef}>`
   - Line 291: `<section className="ld-social">` → `<section className={`ld-social ld-reveal${socialVisible ? ' is-visible' : ''}`} ref={socialRef}>`
   - Line 329: `<section className="ld-final-cta">` → `<section className={`ld-final-cta ld-reveal${finalCtaVisible ? ' is-visible' : ''}`} ref={finalCtaRef}>`
5. In `src/landing.css`, insert the full CSS block shown in Target
   (`.ld-reveal` base + reduced-motion override + the two stagger blocks)
   immediately after line 637 (the closing `}` of the existing hero parallax
   `@media (prefers-reduced-motion: no-preference)` block) and before line
   639 (`/* ── Responsive ── */`).

## Boundaries

- Do NOT touch the hero (`.ld-hero`, `.ld-hero-content`) — its entrance
  already works correctly on mount and is out of scope.
- Do NOT add scroll-reveal to `.ld-social-list` items or `.ld-demo-feats`
  list items — only the 7 named sections plus the 2 named stagger groups
  (mode cards, rank strip). Do not invent additional stagger targets.
- Do NOT change `threshold: 0.15` / `rootMargin: '0px 0px -10% 0px'` in the
  hook — these values make sections reveal slightly before they're fully in
  view, which reads as responsive rather than laggy; do not tune this without
  a feel-check pass.
- Do NOT make the reveal repeatable (no re-observing after the first
  intersection) — a marketing page section re-animating every time the user
  scrolls up and down past it would be distracting, not delightful.
- Do NOT install a scroll-reveal library (`react-intersection-observer`,
  `framer-motion`'s `whileInView`, AOS, etc.) — the native
  `IntersectionObserver` + the hook above is sufficient and matches this
  codebase's zero-dependency approach to motion.
- If any of the 7 section class names, the `.ld-mode-row`/`.ld-mode-card` or
  `.ld-ranks-strip`/`.ld-rank` structure, or the referenced line numbers have
  changed since this plan was written, STOP and report instead of
  improvising — re-locate each section by its class name and verify the
  JSX structure still matches this plan's description (in particular, count
  the actual number of `.ld-rank` children rendered by `RANGOS_PREVIEW` — the
  plan assumes 5, matching the page copy "Cinco escalones"; if it differs,
  report the actual count rather than guessing new nth-child delays).

## Verification

- **Mechanical**: `npx tsc --noEmit` in the repo root — expect no new errors
  (the new hook must typecheck cleanly). Run `npm run dev`, load `/landing`,
  check the browser console for errors.
- **Feel check**:
  - Load `/landing` fresh (hard refresh) and scroll down slowly from the
    top. Each of the 7 sections (demo, modes, rules, ranks, torneos, social,
    final CTA) should fade+rise into place (`opacity: 0 → 1`,
    `translateY(14px) → 0`, per the reused `ldRise` keyframe) as it crosses
    roughly the bottom 85% of the viewport — not fully in view, not exactly
    at the edge.
  - Inside the "Elige cómo jugar" section, the 3 mode cards (Casual, Salas,
    Torneos) should visibly cascade in one after another (~60ms apart), not
    all three appearing simultaneously.
  - Inside the "Tu rango, tu orgullo" section, the 5 rank badges should
    cascade left-to-right in the same staggered fashion.
  - Scroll back up past a section that already revealed, then scroll back
    down to it: it should **already be visible** (no re-trigger, no re-fade)
    — confirms the observer disconnected after first reveal.
  - In DevTools → Rendering panel, set Animations playback to 10% and
    re-scroll to a section: confirm the motion is a simple fade+rise with no
    jitter, and that sibling cards/ranks visibly stagger rather than moving
    as one block.
  - Toggle `prefers-reduced-motion` (Rendering panel): reload the page and
    scroll through all sections — they should all be **immediately fully
    opaque** with no fade/rise and no stagger delay, at every scroll
    position (confirms the `@media (prefers-reduced-motion: reduce)` opacity
    overrides are working, not just "animation: none" leaving elements stuck
    at `opacity: 0`).
  - Resize to mobile width (375px) and repeat the scroll-through: reveal
    and stagger should behave identically (no separate mobile-only CSS
    needed, this plan doesn't touch the `@media (max-width: ...)` blocks).
- **Done when**: all 7 sections reveal on scroll exactly once each, the mode
  cards and rank badges stagger within their revealed section, reduced-motion
  users see everything fully visible with no movement, and there are no
  console errors or TypeScript errors.
