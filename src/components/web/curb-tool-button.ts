import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("curb-tool-button")
export class CurbToolButton extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: String }) icon = "";
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) highlight = false;
  @property({ type: String }) shortcut = "";

  static styles = css`
    :host { display: block; }

    button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      width: 46px;
      height: 46px;
      border: none;
      border-radius: var(--radius-sm, 4px);
      background: transparent;
      color: var(--ink, #2b2b2b);
      cursor: pointer;
      font-family: inherit;
      position: relative;
      transition: background 100ms ease;
    }

    @media (prefers-reduced-motion: reduce) {
      button { transition: none; }
    }

    button:hover:not(:disabled) { background: var(--line, #ddd9d0); }

    button:focus-visible {
      outline: 2px solid var(--moss, #4a7c59);
      outline-offset: 2px;
    }

    :host([active]) button {
      background: var(--moss, #4a7c59);
      color: var(--on-accent, #fff);
    }

    /* The one action we want a user's eye to land on first: not selected yet,
       but visually the obvious next step (e.g. "plan a route"). */
    :host([highlight]:not([active])) button {
      color: var(--moss, #4a7c59);
      box-shadow: inset 0 0 0 2px var(--moss, #4a7c59);
    }
    :host([highlight]:not([active])) button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--moss, #4a7c59) 12%, transparent);
    }

    :host([disabled]) button {
      opacity: 0.4;
      cursor: not-allowed;
      pointer-events: none;
    }

    .icon { font-size: 1rem; line-height: 1; }

    .label {
      font-size: 0.58rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }

    .shortcut {
      position: absolute;
      top: 3px;
      right: 4px;
      font-size: 0.48rem;
      opacity: 0.45;
      font-family: monospace;
    }

    @media (max-width: 600px) {
      button { width: 58px; height: 56px; gap: 4px; }
      .icon { font-size: 1.1rem; }
      .label { font-size: 0.6rem; }
    }
  `;

  render() {
    return html`
      <button
        aria-label=${this.label}
        aria-pressed=${this.active}
        ?disabled=${this.disabled}
        title=${this.shortcut ? `${this.label} (${this.shortcut})` : this.label}
      >
        ${this.shortcut ? html`<span class="shortcut">${this.shortcut}</span>` : ""}
        <span class="icon" aria-hidden="true">${this.icon}</span>
        <span class="label">${this.label}</span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-tool-button": CurbToolButton;
  }
}
