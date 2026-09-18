import type { MeasureResult } from "../../gis/measure";
import type { MapMode } from "../../types/patch";

interface MeasurePanelProps {
  result: MeasureResult;
  coordCount: number;
  mode: MapMode;
  onFinish: () => void;
  onClear: () => void;
}

export function MeasurePanel({ result, coordCount, mode, onFinish, onClear }: MeasurePanelProps) {
  const isPathCheck = mode === "path-check";
  return (
    <div className="tool-panel" aria-live="polite" aria-label={isPathCheck ? "Path drawing" : "Measurement"}>
      <p className="tool-panel__title">{isPathCheck ? "Path Check" : "Measure"}</p>
      <p className="tool-panel__value">{result.meters > 0 ? result.label : "—"}</p>
      <p className="tool-panel__sub">
        {coordCount < 2
          ? (isPathCheck ? "Click the map to draw a path" : "Click to add points")
          : `${coordCount} points · ${isPathCheck ? "Double-click or Finish to check" : "Double-click or Finish to complete"}`}
      </p>
      <div className="tool-panel__actions">
        <button className="btn btn--primary" onClick={onFinish} disabled={coordCount < 2}>
          Finish
        </button>
        <button className="btn" onClick={onClear}>
          Clear
        </button>
      </div>
    </div>
  );
}
