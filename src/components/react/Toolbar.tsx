import { CurbToolButton } from "./CurbToolButton";
import type { MapMode } from "../../types/patch";

interface ToolbarProps {
  mode: MapMode;
  patchCount: number;
  onModeChange: (mode: MapMode) => void;
  onFitToPatches: () => void;
  onExport: () => void;
  onImport: () => void;
  onLocate: () => void;
}

export function Toolbar({ mode, patchCount, onModeChange, onFitToPatches, onExport, onImport, onLocate }: ToolbarProps) {
  return (
    <nav className="toolbar" aria-label="Map tools">
      {/* Route is the primary task — finding a way somewhere. Reports are how
          you check that route for barriers, not the other way around. */}
      <CurbToolButton
        label="Route"
        icon="⇄"
        active={mode === "route"}
        highlight={mode !== "route"}
        onClick={() => onModeChange("route")}
      />
      <div className="toolbar__divider" aria-hidden="true" />
      <CurbToolButton
        label="Browse"
        icon="🗺"
        active={mode === "browse"}
        shortcut="Esc"
        onClick={() => onModeChange("browse")}
      />
      <CurbToolButton
        label="Check"
        icon="🔍"
        active={mode === "path-check"}
        shortcut="P"
        onClick={() => onModeChange("path-check")}
      />
      <CurbToolButton
        label="Patch"
        icon="📍"
        active={mode === "add"}
        shortcut="A"
        onClick={() => onModeChange("add")}
      />
      <CurbToolButton
        label="Measure"
        icon="📏"
        active={mode === "measure"}
        shortcut="M"
        onClick={() => onModeChange("measure")}
      />
      <div className="toolbar__divider" aria-hidden="true" />
      <CurbToolButton
        label="Fit"
        icon="⤢"
        disabled={patchCount === 0}
        onClick={onFitToPatches}
      />
      <CurbToolButton
        label="Export"
        icon="↓"
        disabled={patchCount === 0}
        onClick={onExport}
      />
      <CurbToolButton
        label="Locate"
        icon="◎"
        onClick={onLocate}
      />
      <CurbToolButton
        label="Import"
        icon="↑"
        onClick={onImport}
      />
    </nav>
  );
}
