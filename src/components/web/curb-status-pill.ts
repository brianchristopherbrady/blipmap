import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("curb-status-pill")
export class CurbStatusPill extends LitElement {
  @property({ type: String }) value = "";

  static styles = css`
    :host { display: inline-block; }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 99px;
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: var(--line, #ddd9d0);
      color: var(--ink, #2b2b2b);
    }

    .pill.easy       { background: #d4edda; color: #1a5c2e; }
    .pill.caution    { background: #fde8d0; color: #8a4910; }
    .pill.difficult  { background: #fad5d3; color: #7a1e1a; }
    .pill.observed   { background: #e8f4fd; color: #1a4a6b; }
    .pill.verified   { background: #d4edda; color: #1a5c2e; }
    .pill.resolved   { background: var(--line, #ddd9d0); color: var(--muted, #6b6b6b); }
  `;

  render() {
    return html`<span class="pill ${this.value}">${this.value}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-status-pill": CurbStatusPill;
  }
}
