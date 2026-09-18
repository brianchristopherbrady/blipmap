import type { Patch } from "../types/patch";

export function exportGeoJSON(patches: Patch[]): void {
  const fc = { type: "FeatureCollection" as const, features: patches };
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blipmap-patches-${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
}
