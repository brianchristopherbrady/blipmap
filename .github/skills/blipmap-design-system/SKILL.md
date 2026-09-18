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
  --warning: #d4732a;       /* caution — coral/orange */
  --danger: #c0392b;        /* difficult / destructive */

  /* Shape */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* Elevation */
  --shadow-float: 0 2px 12px rgba(0, 0, 0, 0.12);
}
```

Always reference tokens. Never hardcode color values.

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
