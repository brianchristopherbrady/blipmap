import length from "@turf/length";
import pointToLineDistance from "@turf/point-to-line-distance";
import { lineString, point } from "@turf/helpers";
import type { Position } from "geojson";
import type { Patch, PatchSeverity } from "../types/patch";
import { formatDistance } from "./measure";

export const PATH_CHECK_BUFFER_M = 15;

export interface PathCheckResult {
  distanceMeters: number;
  distanceLabel: string;
  nearby: Patch[];
  difficultCount: number;
  cautionCount: number;
  easyCount: number;
  rating: "clear" | "caution" | "difficult";
  summary: string;
}

export function runPathCheck(coords: Position[], patches: Patch[]): PathCheckResult {
  if (coords.length < 2) {
    return {
      distanceMeters: 0,
      distanceLabel: "0 m",
      nearby: [],
      difficultCount: 0,
      cautionCount: 0,
      easyCount: 0,
      rating: "clear",
      summary: "Draw a longer path to check for nearby observations.",
    };
  }

  const line = lineString(coords);
  const distanceMeters = length(line, { units: "kilometers" }) * 1000;

  const nearby = patches.filter((p) => {
    const pt = point(p.geometry.coordinates);
    return pointToLineDistance(pt, line, { units: "kilometers" }) * 1000 <= PATH_CHECK_BUFFER_M;
  });

  const count = (sev: PatchSeverity) => nearby.filter((p) => p.properties.severity === sev).length;
  const difficultCount = count("difficult");
  const cautionCount   = count("caution");
  const easyCount      = count("easy");

  const rating: PathCheckResult["rating"] =
    difficultCount > 0 ? "difficult" : cautionCount > 0 ? "caution" : "clear";

  const summary = buildSummary(rating, difficultCount + cautionCount);

  return { distanceMeters, distanceLabel: formatDistance(distanceMeters), nearby, difficultCount, cautionCount, easyCount, rating, summary };
}

function buildSummary(rating: PathCheckResult["rating"], issueCount: number): string {
  if (rating === "clear") return "Looks pleasantly uneventful.";
  return `${issueCount} potential barrier${issueCount !== 1 ? "s" : ""} close to this path.`;
}
