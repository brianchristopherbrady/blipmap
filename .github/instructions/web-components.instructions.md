---
applyTo: "src/components/web/**"
description: "Use when writing Lit custom elements for blipmap: curb-* naming, reactive properties, CSS custom property styling, typed CustomEvent emission, and accessibility attributes."
---

# Web Component (Lit) Conventions

## Required Imports

```ts
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
```

## Element Naming

- Tag: `curb-<name>` (kebab-case, always `curb-` prefix)
- Class: `Curb<Name>` (PascalCase)
- File: `src/components/web/curb-<name>.ts`

## Event Emission

```ts
this.dispatchEvent(new CustomEvent("curb-<event-name>", {
  detail: { /* typed payload */ },
  bubbles: true,
  composed: true,   // required to cross shadow DOM boundary
}));
```

Always `bubbles: true, composed: true`. Always define a type for `detail`.

## CSS Custom Property Tokens

```css
--ink            /* primary text */
--paper          /* base surface */
--paper-raised   /* elevated surface */
--moss           /* accent / selected state */
--warning        /* caution orange */
--danger         /* difficult / destructive */
--muted          /* secondary text */
--line           /* borders */
--radius-sm  --radius-md
--shadow-float
```

Never hardcode color values. Never use Tailwind or any utility class framework.

## Accessibility Checklist

- Buttons: use `<button>` element, never `<div>` or `<span>`
- Icon-only: `aria-label` required
- Toggle state: `aria-pressed=${this.active}`
- Boolean properties: `reflect: true` so `:host([active])` CSS works
- Focus: visible `:focus-visible` outline using `--moss`

## Never in a Lit File

- `import React ...`
- Direct calls to React state setters
- `import ... from "../../data/db"`
