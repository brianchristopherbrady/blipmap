import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("curb-tool-button")
export class CurbToolButton extends LitElement {
  @property({ type: String }) label = "";
  @property({ type: String }) icon = "";
  @property({ type: Boolean, reflect: true }) active = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
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

    button:hover:not(:disabled) { background: var(--line, #ddd9d0); }

    button:focus-visible {
      outline: 2px solid var(--moss, #4a7c59);
      outline-offset: 2px;
    }

    :host([active]) button {
      background: var(--moss, #4a7c59);
      color: #fff;
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
