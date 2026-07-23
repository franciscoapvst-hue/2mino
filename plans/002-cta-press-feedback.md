# 002 — Add `:active` press feedback to landing CTA buttons

- **Status**: DONE
- **Commit**: d5b17a6
- **Severity**: MEDIUM
- **Category**: Physicality & origin
- **Estimated scope**: 1 file (`src/landing.css`), 4 rule blocks touched

## Problem

Every clickable button on the landing page has a hover state (a lift via
`transform: translateY(-1px)` and a color/border change) but **none of them
have a `:active` (press) state**. The most important control on the entire
page — the single hero CTA "Jugar gratis ahora" — gives the user zero
tactile feedback when they physically click it. On a touch device there is
no hover at all, so the press is the *only* feedback available, and it's
currently missing everywhere.

Current code, `src/landing.css`:

```css
/* line 209-226 — .ld-btn-primary (the hero CTA, final CTA, "Quiero competir") */
.ld-btn-primary {
  padding: 14px 26px;
  border: none;
  border-radius: 12px;
  background: var(--amber);
  color: var(--amber-ink);
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  transition: transform .16s ease, box-shadow .2s ease, background .16s ease;
  box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--amber) 70%, transparent);
}
.ld-btn-primary:hover {
  background: var(--amber-hi);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -8px color-mix(in srgb, var(--amber) 80%, transparent);
}
.ld-btn-primary:focus-visible { outline: 2px solid #f4ecdd; outline-offset: 2px; }
```

```css
/* line 233-245 — .ld-btn-ghost ("Ya tengo cuenta" style, currently unused in JSX but still in CSS) */
.ld-btn-ghost {
  padding: 14px 26px;
  border-radius: 12px;
  border: 1.5px solid rgba(244, 236, 221, 0.28);
  background: transparent;
  color: #f4ecdd;
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}
.ld-btn-ghost:hover { border-color: #f4ecdd; background: rgba(244, 236, 221, 0.06); transform: translateY(-1px); }
.ld-btn-ghost:focus-visible { outline: 2px solid #f4ecdd; outline-offset: 2px; }
```

```css
/* line 97-109 — .ld-nav-cta ("Crear cuenta" in the sticky nav) */
.ld-nav-cta {
  padding: 9px 18px;
  border-radius: 10px;
  border: none;
  background: var(--amber);
  color: var(--amber-ink);
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background .16s ease, transform .16s ease;
}
.ld-nav-cta:hover { background: var(--amber-hi); transform: translateY(-1px); }
.ld-nav-cta:focus-visible { outline: 2px solid var(--l-ink); outline-offset: 2px; }
```

```css
/* line 69-82 — .ld-theme (the sun/moon theme toggle icon button) */
.ld-theme {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid var(--l-border);
  background: var(--l-surface);
  color: var(--l-ink);
  cursor: pointer;
  transition: border-color .16s ease, transform .16s ease;
}
.ld-theme:hover { border-color: var(--amber); transform: translateY(-1px); }
.ld-theme:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
```

## Target

Add an `:active` rule to each of the four button classes above. Per
`AUDIT.md` §3 (Physicality & origin — Press feedback): `transform:
scale(0.97)` on `:active`, transition `160ms ease-out`, kept subtle
(0.95–0.98 range). These buttons already have a `transform` transition in
their base rule (for the hover lift), so the press just needs the `:active`
selector added — no new transition property required, but the duration must
match the audit's 160ms budget, so update the existing transitions'
duration for the `transform` component to `160ms` where it differs, and add
`ease-out` as the additional easing keyword only for the active-state feel
(see per-rule notes below — do not remove the existing hover behavior).

```css
/* target — .ld-btn-primary */
.ld-btn-primary {
  padding: 14px 26px;
  border: none;
  border-radius: 12px;
  background: var(--amber);
  color: var(--amber-ink);
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  transition: transform .16s ease, box-shadow .2s ease, background .16s ease;
  box-shadow: 0 8px 22px -8px color-mix(in srgb, var(--amber) 70%, transparent);
}
.ld-btn-primary:hover {
  background: var(--amber-hi);
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -8px color-mix(in srgb, var(--amber) 80%, transparent);
}
.ld-btn-primary:active {
  transform: scale(0.97);
  transition: transform 160ms ease-out;
}
.ld-btn-primary:focus-visible { outline: 2px solid #f4ecdd; outline-offset: 2px; }
```

```css
/* target — .ld-btn-ghost */
.ld-btn-ghost:hover { border-color: #f4ecdd; background: rgba(244, 236, 221, 0.06); transform: translateY(-1px); }
.ld-btn-ghost:active {
  transform: scale(0.97);
  transition: transform 160ms ease-out;
}
.ld-btn-ghost:focus-visible { outline: 2px solid #f4ecdd; outline-offset: 2px; }
```

```css
/* target — .ld-nav-cta */
.ld-nav-cta:hover { background: var(--amber-hi); transform: translateY(-1px); }
.ld-nav-cta:active {
  transform: scale(0.97);
  transition: transform 160ms ease-out;
}
.ld-nav-cta:focus-visible { outline: 2px solid var(--l-ink); outline-offset: 2px; }
```

```css
/* target — .ld-theme */
.ld-theme:hover { border-color: var(--amber); transform: translateY(-1px); }
.ld-theme:active {
  transform: scale(0.93);
  transition: transform 160ms ease-out;
}
.ld-theme:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
```

Note: `.ld-theme` is a small 38×38px icon button, not a text pill — use
`scale(0.93)` for it (still inside the audit's 0.90–0.97 physicality range
for the general "never scale(0)" rule, and appropriately more noticeable on
a small tap target) instead of `0.97`, which would barely register visually
at that size.

## Repo conventions to follow

- This codebase has no shared easing/duration tokens file for the landing
  page (see Finding #3 in the audit — a separate, lower-priority
  consolidation item, out of scope here). Write the literal values
  (`160ms`, `ease-out`, `scale(0.97)` / `scale(0.93)`) directly in each rule,
  matching how every other transition in this file is already written
  literally (e.g. `transition: transform .16s ease, box-shadow .2s ease,
  background .16s ease` at `src/landing.css:218`).
- Follow the existing selector order in each block: base rule, then
  `:hover`, then the new `:active`, then `:focus-visible` last — this
  matches the order already used for `.ld-btn-primary`, `.ld-btn-ghost`,
  `.ld-nav-cta`, and `.ld-theme`.
- `.dash-card`/`.dash-featured` elsewhere in the app (`src/dashboard.css`)
  use a similar hover-lift-only pattern with no active state — this plan
  intentionally does not touch those; it is scoped to `src/landing.css`
  only per the audit's per-page scope.

## Steps

1. In `src/landing.css`, after the `.ld-theme:hover` rule (line 81), add the
   new `.ld-theme:active` rule shown in Target, before `.ld-theme:focus-visible`
   (line 82).
2. After the `.ld-nav-cta:hover` rule (line 108), add the new
   `.ld-nav-cta:active` rule shown in Target, before `.ld-nav-cta:focus-visible`
   (line 109).
3. After the `.ld-btn-primary:hover` rule (lines 221-225), add the new
   `.ld-btn-primary:active` rule shown in Target, before
   `.ld-btn-primary:focus-visible` (line 226).
4. After the `.ld-btn-ghost:hover` rule (line 244), add the new
   `.ld-btn-ghost:active` rule shown in Target, before `.ld-btn-ghost:focus-visible`
   (line 245).

## Boundaries

- Do NOT modify the base rules' existing `transition` shorthand lines (e.g.
  `src/landing.css:218`) — only add new `:active` blocks. The `:active`
  rule's own `transition: transform 160ms ease-out` will correctly override
  the transform-duration for the press/release moment via CSS specificity
  (same selector count, later in source order) without needing to touch the
  base rule.
- Do NOT add `:active` states to non-CTA elements (`.ld-link`, `.ld-chip`,
  `.ld-mode-card`, `.ld-featured`, `.ld-rank`, etc.) — those are out of
  scope for this plan (cards use a lift-only hover per this page's existing
  pattern, and are not primary CTAs).
- Do NOT change `border-radius`, `padding`, colors, or box-shadow values.
- Do NOT touch `src/components/LandingScreen.tsx` — this is a CSS-only plan.
- If any of the four quoted rule blocks has drifted from the current file
  (different property values, different line numbers), STOP and report
  instead of improvising — re-locate the selector by name and verify the
  surrounding hover/focus-visible rules still match this plan's description
  before proceeding.

## Verification

- **Mechanical**: no build step needed for a CSS-only change; confirm the
  dev server hot-reloads without a CSS parse error (check the terminal
  running `npm run dev` for Vite errors after saving).
- **Feel check**: load `/landing` in a browser.
  - Click and hold (mousedown, don't release) the hero "Jugar gratis ahora"
    button — it should visibly shrink slightly (~3%) while held, and spring
    back to normal size on release. It should not jump or flicker.
  - Repeat for the sticky-nav "Crear cuenta" button and the "Quiero
    competir" button in the torneos section (both `.ld-btn-primary`).
  - Click-and-hold the sun/moon theme toggle in the nav — it should shrink
    slightly more noticeably (~7%) than the text buttons, since it's a small
    icon target.
  - In DevTools → Rendering panel, set Animations playback to 10% (or use
    the Elements panel's computed style while holding mousedown) and
    confirm the scale transition takes visibly longer than instant but
    finishes quickly (~160ms) — it should feel snappy, not sluggish.
  - Toggle `prefers-reduced-motion` (DevTools → Rendering panel → "Emulate
    CSS media feature prefers-reduced-motion: reduce"): the press scale
    feedback should still occur (per AUDIT.md §6, reduced motion means
    "fewer and gentler animations, not zero" — this is a tiny opacity-free
    scale transform giving essential press feedback, not decorative
    movement, so it is intentionally NOT gated behind a reduced-motion media
    query. Confirm it still fires.)
- **Done when**: all four button classes shrink subtly on `:active` and
  restore on release, with no visual jump/flash, and the existing hover
  lift and focus-visible outline behavior are unchanged.
