---
name: blipmap-design-system
description: "Use when adding or changing UI styles in blipmap: applying CSS custom properties, designing a new component's visual appearance, adjusting the color palette, writing microcopy, ensuring visual consistency across panels and toolbar, or checking that new UI follows the 'pocket field notebook' aesthetic."
---

# blipmap Design System

## When to Use
- Styling a new component or panel
- Adjusting colors, spacing, or typography
- Writing microcopy for empty states, confirmations, or status messages
- Ensuring a new feature matches the existing visual language

## Design Personality

> Pocket field notebook meets modern GIS utility.

- Warm off-white surfaces floating over the map
- Dark graphite text — no pure black
- One strong moss/leaf accent
- Coral/orange for warnings; never playful neon
- Restrained, subtle animations
- Tactile, rounded controls

NOT: children's software, pastel SaaS dashboard, glassmorphism, neon cyberpunk, generic Tailwind UI.

## CSS Token Reference

Defined in [src/styles/tokens.css](../../../src/styles/tokens.css). Light values shown; a
`@media (prefers-color-scheme: dark)` block overrides the color tokens with a dark palette that
keeps the same relationships (surfaces stay warm/neutral, moss stays the one accent).

```css
:root {
  /* Text */
  --ink: #2b2b2b;           /* primary text — dark graphite */
  --muted: #6b6b6b;         /* secondary text */

  /* Surfaces */
  --paper: #f5f3ee;         /* base background — warm off-white */
  --paper-raised: #ffffff;  /* elevated card/panel surface */
  --line: #ddd9d0;          /* borders and dividers */

  /* Accents */
  --moss: #4a7c59;          /* primary accent — leaf/moss green */
  --moss-strong: #3d6b4c;   /* hover/pressed state for moss-filled controls */
  --warning: #d4732a;       /* caution — coral/orange */
  --danger: #c0392b;        /* difficult / destructive */
  --route: #3b7dd8;         /* route line + "start" pin on the map */
  --on-accent: #ffffff;     /* text placed on an accent fill — flips per theme for AA contrast */

  /* Status tints (pills, ratings, banners) */
  --status-easy-bg: #d4edda;      --status-easy-fg: #1a5c2e;
  --status-caution-bg: #fde8d0;   --status-caution-fg: #8a4910;
  --status-difficult-bg: #fad5d3; --status-difficult-fg: #7a1e1a;
  --status-observed-bg: #e8f4fd;  --status-observed-fg: #1a4a6b;

  /* Overlay / scrim */
  --overlay: rgb(0 0 0 / 32%);         /* modal-overlay backdrop */
  --dialog-backdrop: rgb(0 0 0 / 35%); /* native <dialog>::backdrop */

  /* Shape */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* Spacing scale (2px base, used for gaps/padding on new components) */
  --space-1: 2px; --space-2: 4px; --space-3: 6px; --space-4: 8px; --space-5: 10px;
  --space-6: 12px; --space-7: 16px; --space-8: 20px; --space-9: 24px;

  /* Elevation */
  --shadow-float: 0 2px 12px rgba(0, 0, 0, 0.12);

  /* Layering — use these instead of ad-hoc z-index numbers */
  --z-panel: 10;       /* records panel */
  --z-tool-panel: 15;  /* measure / path-check floating panel */
  --z-chrome: 20;       /* header, toolbar, route panel */
  --z-form: 30;         /* patch form, profile drawer */
  --z-suggestions: 40; /* autocomplete lists */
  --z-toast: 50;
  --z-modal: 100;

  /* Motion */
  --motion-fast: 100ms;
  --motion-base: 150ms;
  --motion-easing: ease;
}
```

Always reference tokens. Never hardcode color values. Lit components keep a hardcoded fallback in
`var(--token, #hex)` form only because shadow DOM styles can render before `tokens.css` is parsed —
the fallback must match the light-mode token value, and the real value still comes from the token.

### Dark mode, reduced motion, and contrast

- Dark mode responds automatically to `prefers-color-scheme: dark` — there is no in-app toggle yet.
  Any new component must read color through tokens (never assume light-mode hex) so it adapts for free.
- `prefers-reduced-motion: reduce` is handled globally in `global.css` (collapses all
  transitions/animations) and individually inside each Lit component's `static styles` (shadow DOM
  doesn't inherit the global rule).
- `prefers-contrast: more` strengthens `--line` so borders stay visible.
- MapLibre paint properties and marker DOM elements can't read CSS custom properties directly.
  `<curb-map>` resolves theme colors at runtime via `getComputedStyle` and repaints on
  `prefers-color-scheme` change — see `_applyThemePaint` in
  [curb-map.ts](../../../src/components/web/curb-map.ts). Any new map layer/marker color must go
  through that same resolution path, not a literal hex value.

## Severity Color Mapping

| Severity | Token | Usage |
|----------|-------|-------|
| `easy` | `--moss` | Green tint/ring |
| `caution` | `--warning` | Orange tint/ring |
| `difficult` | `--danger` | Red tint/ring |

## Patch Category Icon Convention

Use small SVG marks or Unicode symbols per category. Keep them monochrome; severity communicates urgency via color. Icons must have an accessible label (tooltip or `aria-label`).

## Typography

Use a system font stack — no blocking font dependency:

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;
```

Hierarchy:
- Panel headers: `0.75rem`, `font-weight: 600`, `letter-spacing: 0.08em`, `text-transform: uppercase`, `color: var(--muted)`
- Card titles: `0.9rem`, `font-weight: 500`
- Body / notes: `0.85rem`, `color: var(--ink)`
- Coordinates / metadata: `0.75rem`, `color: var(--muted)`, monospace

## Layout Principles

- Map is the application. UI floats over it — no full-height sidebars that block the map.
- Desktop: compact vertical toolbar (left), floating records drawer (right), contextual panel (lower-left).
- Mobile: toolbar becomes compact bottom strip; records panel becomes bottom sheet; touch targets ≥ 44px.
- Use `position: fixed` or `position: absolute` for floating panels, with `z-index` tiers:
  - Map: 0
  - Floating panels: 10
  - Toolbar: 20
  - Modals/forms: 30

## Animation

```css
/* Standard transition for state changes */
transition: opacity 150ms ease, transform 150ms ease;

/* Panel enter */
@keyframes slide-up {
  from { transform: translateY(8px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}
```

Keep durations ≤ 200ms. Never animate layout properties (`width`, `height`) — use `transform` and `opacity`.

## Microcopy Tone

Understated, slightly charming field-notebook voice. Never corporate, never childish.

| Context | Copy |
|---------|------|
| Empty patches list | "Nothing weird here yet." |
| Empty map first run | "Nothing weird here yet. Drop a Patch to start mapping the block." |
| Add Patch button | "Drop a Patch" |
| Measure mode | "Walk the line" |
| Delete confirmation | "Remove this Patch?" |
| Path Check — no issues | "Looks pleasantly uneventful." |
| Import success | "Imported {n} Patches." |
| Import partial | "Imported {n} Patches. Skipped {k} invalid records." |
| Seed data clear | "Demo data cleared." |

## Component States

Every interactive component must implement:
- **Default** — resting state
- **Hover** — subtle background lift (`filter: brightness(0.97)` or similar)
- **Active/Pressed** — `--moss` accent ring or slight scale
- **Focus-visible** — `outline: 2px solid var(--moss); outline-offset: 2px`
- **Disabled** — `opacity: 0.45; pointer-events: none`

Never rely solely on color to communicate state; pair with shape or label change.

## Path Check Result Styles

| Rating | Color | Icon |
|--------|-------|------|
| `clear` | `--moss` | ✓ |
| `caution` | `--warning` | ! |
| `difficult` | `--danger` | ✗ |

## Common Mistakes

- Hardcoding `#4a7c59` instead of `var(--moss)` — prevents future theme changes.
- Using `color: black` instead of `color: var(--ink)`.
- Hover-only interactions with no keyboard equivalent.
- Touch targets smaller than 44px on mobile.
- Large permanent chrome that covers the map on desktop.
