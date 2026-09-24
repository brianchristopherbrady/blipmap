import type { ReactNode } from "react";
import { createElement, type IconNode } from "lucide";

export function PanelIcon({ icon }: { icon: IconNode }) {
  return <span className="panel-icon" aria-hidden="true" ref={element => {
    element?.replaceChildren(createElement(icon));
  }} />;
}

export function ContextPanel({ title, actions, children, expanded = false }: {
  title: string;
  actions: ReactNode;
  children: ReactNode;
  // Full-height on mobile once there's genuinely tall content (e.g. route
  // results/directions) to scroll through; otherwise stay a partial sheet
  // so the map \u2014 and its clickable clusters/markers \u2014 stays reachable.
  expanded?: boolean;
}) {
  return <aside className={`context-panel${expanded ? " context-panel--expanded" : ""}`} aria-label={title}>
    <header className="context-panel__header">
      <h2>{title}</h2>
      <div className="context-panel__actions">{actions}</div>
    </header>
    <div className="context-panel__body">{children}</div>
  </aside>;
}