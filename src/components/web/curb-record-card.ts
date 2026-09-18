import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { PatchCategory, PatchSeverity, PatchStatus } from "../../types/patch";

@customElement("curb-record-card")
export class CurbRecordCard extends LitElement {
  @property({ type: String }) patchId = "";
  @property({ type: String }) title = "";
  @property({ type: String }) category: PatchCategory = "other";
  @property({ type: String }) severity: PatchSeverity = "caution";
  @property({ type: String }) status: PatchStatus = "observed";
  @property({ type: Boolean, reflect: true }) selected = false;
  @property({ type: String }) distance = "";

  static styles = css`
    :host { display: block; }

    .card {
      display: block;
      width: 100%;
      text-align: left;
      font-family: inherit;
      padding: 10px 12px;
      border-radius: var(--radius-sm, 4px);
      background: var(--paper-raised, #fff);
      border: 1px solid var(--line, #ddd9d0);
      cursor: pointer;
      transition: box-shadow 120ms ease, border-color 120ms ease;
    }

    .card:hover { box-shadow: 0 1px 6px rgba(0,0,0,0.08); }

    :host([selected]) .card {
      border-color: var(--moss, #4a7c59);
      box-shadow: 0 0 0 2px rgba(74,124,89,0.18);
    }

    .card:focus-visible {
      outline: 2px solid var(--moss, #4a7c59);
      outline-offset: 2px;
    }

    .header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .dot.easy      { background: var(--moss, #4a7c59); }
    .dot.caution   { background: var(--warning, #d4732a); }
    .dot.difficult { background: var(--danger, #c0392b); }

    .title {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--ink, #2b2b2b);
      flex: 1;
      line-height: 1.3;
    }

    .distance {
      font-size: 0.65rem;
      color: var(--muted, #6b6b6b);
      flex-shrink: 0;
    }

    .meta {
      display: flex;
      gap: 5px;
      margin-top: 6px;
      padding-left: 17px;
      flex-wrap: wrap;
    }

    .badge {
      font-size: 0.63rem;
      padding: 1px 6px;
      border-radius: 99px;
      background: var(--line, #ddd9d0);
      color: var(--muted, #6b6b6b);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
  `;

  private _handleClick() {
    this.dispatchEvent(new CustomEvent<{ id: string }>("curb-record-select", {
      detail: { id: this.patchId },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <button
        class="card"
        type="button"
        @click=${this._handleClick}
        aria-haspopup="dialog"
        aria-label="${this.title}, ${this.severity}"
      >
        <span class="header">
          <span class="dot ${this.severity}" aria-hidden="true"></span>
          <span class="title">${this.title}</span>
          ${this.distance ? html`<span class="distance">${this.distance}</span>` : ""}
        </span>
        <span class="meta">
          <span class="badge">${this.category}</span>
          <span class="badge">${this.status}</span>
        </span>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "curb-record-card": CurbRecordCard;
  }
}
