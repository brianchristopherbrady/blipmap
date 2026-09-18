import type { PathCheckResult } from "../../gis/pathCheck";

interface PathCheckPanelProps {
  result: PathCheckResult;
  onSelectPatch: (id: string) => void;
  onClose: () => void;
}

const RATING_LABELS = {
  clear: "Clear",
  caution: "Caution",
  difficult: "Difficult",
} as const;

export function PathCheckPanel({ result, onSelectPatch, onClose }: PathCheckPanelProps) {
  return (
    <div className="tool-panel" aria-label="Path Check results" aria-live="polite">
      <p className="tool-panel__title">Path Check</p>
      <p className="tool-panel__value">{result.distanceLabel}</p>

      <span className={`path-check-rating ${result.rating}`} role="status">
        {RATING_LABELS[result.rating]}
      </span>

      <p className="tool-panel__sub" style={{ marginTop: 6 }}>
        {result.summary}
        {result.nearby.length > 0 &&
          ` · ${result.nearby.length} observation${result.nearby.length !== 1 ? "s" : ""} nearby`}
      </p>

      {result.nearby.length > 0 && (
        <>
          <p style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontWeight: 600 }}>
            Nearby
          </p>
          <ul className="path-check-list" aria-label="Nearby patches">
            {result.nearby.map((patch) => (
              <li key={patch.id}>
                <button
                  className="path-check-list__item"
                  onClick={() => onSelectPatch(patch.id)}
                >
                  <span className={`path-check-list__dot ${patch.properties.severity}`} aria-hidden="true" />
                  {patch.properties.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="tool-panel__actions" style={{ marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
