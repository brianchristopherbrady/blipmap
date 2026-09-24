import type { MeasureResult } from "../../gis/measure";
import type { MapMode } from "../../types/patch";

interface MeasurePanelProps {
  result: MeasureResult;
  coordCount: number;
  mode: MapMode;
  finished: boolean;
}

export function MeasurePanel({ result, coordCount, mode, finished }: MeasurePanelProps) {
  const isPathCheck = mode === "path-check";
  return (
    <div className="tool-panel" aria-live="polite" aria-label={isPathCheck ? "Path drawing" : "Measurement"}>
      <p className="tool-panel__value">{result.meters > 0 ? result.label : "—"}</p>
      <p className="tool-panel__sub">
        {finished ? "Measurement complete" : `${coordCount} points ${isPathCheck ? "in path" : "measured"}`}
      </p>
    </div>
  );
}
