---
applyTo: "src/components/react/**"
description: "Use when writing React components for blipmap: @lit/react wrappers, panel composition, form state, and CustomEvent wiring."
---

# React Component Conventions

## @lit/react Wrapper Pattern

```tsx
import { createComponent } from "@lit/react";
import React from "react";
import { CurbMyElement } from "../web/curb-my-element";

export type MyActionEvent = CustomEvent<{ id: string }>;

export const CurbMyComponent = createComponent({
  tagName: "curb-my-element",
  elementClass: CurbMyElement,
  react: React,
  events: {
    onAction: "curb-my-action",   // camelCase prop → kebab-case event name
  },
});
```

## Application State Shape

```ts
// Top-level React state (App.tsx or equivalent)
const [patches, setPatches]       // Patch[] — mirrors IndexedDB
const [mode, setMode]             // MapMode — "browse"|"add"|"measure"|"path-check"
const [selectedId, setSelectedId] // string | null
const [filters, setFilters]       // { category?, severity?, status?, query? }
```

All state derivation (filtered patches, selected patch) is memoized with `useMemo`.

## Mode Transitions

```ts
// ESC always resets to browse and clears temp geometry
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") setMode("browse");
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

Do not handle ESC inside Lit components — handle it in the React layer.

## Form Conventions

- Use controlled inputs — `value` + `onChange`.
- Validate required fields before enabling Save.
- On cancel: remove the temporary map marker, reset mode.
- On save: persist to IndexedDB first, then update React state.
