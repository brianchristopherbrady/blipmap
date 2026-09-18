import length from "@turf/length";
import { lineString } from "@turf/helpers";
import type { Position } from "geojson";

export interface MeasureResult {
  meters: number;
  label: string;
  segmentMeters: number[];
}

export function measurePath(coords: Position[]): MeasureResult {
  if (coords.length < 2) return { meters: 0, label: "0 m", segmentMeters: [] };

  const segmentMeters: number[] = [];
  for (let i = 1; i < coords.length; i++) {
    const km = length(lineString([coords[i - 1], coords[i]]), { units: "kilometers" });
    segmentMeters.push(km * 1000);
  }

  const meters = segmentMeters.reduce((a, b) => a + b, 0);
  return { meters, label: formatDistance(meters), segmentMeters };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
