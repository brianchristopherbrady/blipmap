---
name: blipmap-web-components
description: "Use when creating a new Lit web component for blipmap, updating an existing curb-* custom element, creating or fixing an @lit/react wrapper, debugging property binding or CustomEvent wiring, or adding accessible ARIA attributes to a component. Covers the full Lit 3 + @lit/react pattern used in src/components/web/ and src/components/react/."
---

# blipmap Web Component Authoring

## When to Use
- Creating a new `<curb-*>` custom element
- Adding a reactive property or emitting a new `CustomEvent`
- Creating or updating a `@lit/react` wrapper
- Fixing TypeScript event typing for a custom element
- Adding or adjusting component styles

## File Layout

```
src/components/web/<element-name>.ts     ← Lit custom element
src/components/react/<ElementName>.tsx   ← @lit/react wrapper
```

## Procedure

### 1. Create the Lit Custom Element

```ts
// src/components/web/curb-my-widget.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("curb-my-widget")
export class CurbMyWidget extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: Boolean, reflect: true }) active = false;

  static styles = css`
    :host {
      display: inline-flex;
      background: var(--paper-raised);
      color: var(--ink);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-float);
    }
    :host([active]) {
      outline: 2px solid var(--moss);
    }
  `;

  private _handleClick() {
    this.dispatchEvent(
      new CustomEvent("curb-my-widget-action", {
        detail: { label: this.label },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <button
        part="button"
        aria-label=${this.label}
        aria-pressed=${this.active}
        @click=${this._handleClick}
      >
        ${this.label}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-my-widget": CurbMyWidget;
  }
}
```

### 2. Create the @lit/react Wrapper

```tsx
// src/components/react/CurbMyWidget.tsx
import { createComponent } from "@lit/react";
import React from "react";
import { CurbMyWidget as CurbMyWidgetElement } from "../web/curb-my-widget";

export type CurbMyWidgetActionEvent = CustomEvent<{ label: string }>;

export const CurbMyWidget = createComponent({
  tagName: "curb-my-widget",
  elementClass: CurbMyWidgetElement,
  react: React,
  events: {
    onAction: "curb-my-widget-action",
  },
});
```

### 3. Use in React

```tsx
import { CurbMyWidget } from "./components/react/CurbMyWidget";

function Toolbar() {
  return (
    <CurbMyWidget
      label="My Widget"
      active={isActive}
      onAction={(e) => handleAction(e.detail.label)}
    />
  );
}
```

## Constraints

- **Never import React inside a Lit file.** Lit must remain framework-agnostic.
- **Never set React state from inside a Lit component.** Emit a `CustomEvent` instead.
- **Always use `bubbles: true, composed: true`** on CustomEvents so they escape shadow DOM.
- **Style with CSS custom properties only.** No inline styles, no Tailwind.
- **Always reflect boolean properties** with `reflect: true` so CSS `:host([active])` works.

## CSS Token Reference

```css
--ink            /* primary text */
--paper          /* base surface */
--paper-raised   /* elevated surface */
--moss           /* accent / selected */
--warning        /* caution orange */
--danger         /* difficult / destructive */
--muted          /* secondary text */
--line           /* borders / dividers */
--radius-sm      /* small corner radius */
--radius-md      /* medium corner radius */
--shadow-float   /* floating panel shadow */
```

## Accessibility Checklist

- [ ] Buttons use `<button>` element (not `<div>`)
- [ ] `aria-label` present when icon-only
- [ ] `aria-pressed` on toggle buttons
- [ ] `aria-live="polite"` on status regions
- [ ] Focus styles visible (`outline` or `box-shadow` on `:focus-visible`)
- [ ] Touch targets ≥ 44px

## Existing Elements Quick Reference

| Element | Key Properties | Events |
|---------|---------------|--------|
| `<curb-map>` | `mode`, `patches`, `selectedId` | `curb-map-click`, `curb-map-ready`, `curb-record-select`, `curb-measure-change`, `curb-path-complete` |
| `<curb-tool-button>` | `label`, `icon`, `active`, `disabled`, `shortcut` | — |
| `<curb-record-card>` | `title`, `category`, `severity`, `status`, `selected`, `distance` | — |
| `<curb-status-pill>` | `value`, `variant` | — |
