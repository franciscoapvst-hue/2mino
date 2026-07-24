# Animation plans — Landing page

Produced by `improve-animations` (audit at commit `d5b17a6`). Scope: `src/components/LandingScreen.tsx` + `src/landing.css`.

| # | Title | Severity | Category | Status |
|---|-------|----------|----------|--------|
| [001](001-throttle-hero-parallax.md) | Throttle the hero mouse-parallax to avoid forced layout every mousemove | HIGH | Performance | DONE |
| [002](002-cta-press-feedback.md) | Add `:active` press feedback to landing CTA buttons | MEDIUM | Physicality & origin | DONE |
| [003](003-scroll-reveal-landing-sections.md) | Scroll-reveal the 7 below-fold sections, with stagger on mode cards + rank strip | LOW label / HIGH impact | Missed opportunities + Cohesion | DONE |

## Verification note (2026-07-22)

All three implemented and typechecked clean (`npx tsc --noEmit`), no new
console errors. CSSOM inspection confirmed every rule (durations, easing,
nth-child delays, `:active` scale values, reduced-motion overrides) matches
each plan's Target section exactly.

**Not live-verified**: the dev-tooling browser used for this pass reports
`document.visibilityState: "hidden"` — Chrome pauses `requestAnimationFrame`
and throttles `IntersectionObserver` callbacks for backgrounded tabs, so
neither 001's rAF-throttled parallax nor 003's scroll-reveal trigger could be
watched actually firing in that harness. The code was reviewed line-by-line
against the plan and mirrors the already-shipped `useMeasuredWidth` hook's
proven pattern, but **do the feel-checks in each plan's Verification section
in a real, focused browser tab** before calling 001 and 003 fully done. 002
(CSS `:active`, no JS) has no such gap — the rules were confirmed in the
CSSOM; a real click-and-hold is still worth doing for feel, not correctness.

## Recommended execution order

**001 → 002 → 003**, and they can be done in any order safely (no file overlaps
except all three touch `src/landing.css`, but in disjoint rule blocks — see
below). 001 is pure JS/perf and the most self-contained; 002 is four small CSS
additions; 003 is the largest (new hook + 7 JSX edits + a CSS block) and
benefits from the codebase already being clean from 001/002 when reviewing the
diff.

## Dependencies between plans

- **No hard dependencies.** Each plan can be executed and reviewed independently.
- **File overlap**: 002 and 003 both edit `src/landing.css`, but in
  non-overlapping regions (002 touches `.ld-theme`/`.ld-nav-cta`/
  `.ld-btn-primary`/`.ld-btn-ghost` `:active` rules around lines 82/109/226/245;
  003 appends a new block after line 637). Executing them in the same working
  tree back-to-back is safe; executing them in parallel worktrees will need a
  trivial merge (both are pure additions, no shared lines).
- 003 is the only plan that adds a new file (`src/hooks/useReveal.ts`) — no
  conflict risk with 001/002.

## Findings not turned into plans (this pass)

Recorded here so they aren't lost, per the original audit — not written up
as plans because they're consolidation/polish, not high-leverage on their own:

- **Chat-bubble scale-in origin size** (`src/landing.css:348`, `ldBubble`
  keyframe) — starts at `scale(0.6)`, audit target is `0.9–0.97`. Low severity,
  borderline (decorative demo loop, correct `transform-origin`).
- **Hover lifts not gated to `(hover: hover)`** — several `:hover` transform
  rules (`src/landing.css:81,108,221,244,421,458`) fire on touch-tap. Low
  severity, transient effect.
- **Motion token consolidation** — `cubic-bezier(.2,.7,.2,1)` is hand-typed 4×
  across `landing.css`; a near-duplicate `(.3,.7,.3,1)` also exists
  (`landing.css:318`). Worth a `--ld-ease` custom property once more of the
  page's motion is touched, not urgent on its own.
- **Dead transition on `.ld-art-tile`** (`src/landing.css:576-580`) — a
  `transform` transition is defined but nothing currently varies that
  transform. Either wire it to the hero's parallax mechanism (an additive
  "Opportunity C" from the audit) or drop the unused transition — deferred,
  ask before picking a direction.
