---
name: blipmap-gis-ops
description: "Use when writing or modifying spatial analysis functions for blipmap: geodesic measurement, Path Check point-to-line proximity, bounding box fitting, GeoJSON import validation, or any Turf.js operation. Also use when writing Vitest tests for src/gis/ functions."
---

# blipmap GIS Operations

## When to Use
- Implementing a new spatial analysis function
- Modifying measure, Path Check, or bounding-box logic
- Writing or fixing Vitest tests for `src/gis/`
- Debugging Turf.js usage or unit conversion errors

## Core Rules

All functions in `src/gis/` must be **pure**:
- No imports from React, IndexedDB helpers, or component files
- No side effects — never mutate inputs
- Deterministic — same inputs always produce same output
- Strongly typed — never use `any`

## Turf Import Pattern

Import from individual packages, not the barrel:

```ts
import length from "@turf/length";
import pointToLineDistance from "@turf/point-to-line-distance";
import bbox from "@turf/bbox";
import bboxPolygon from "@turf/bbox-polygon";
import { featureCollection, lineString, point } from "@turf/helpers";
import type { Feature, LineString, Point, Position } from "geojson";
```

## Unit Convention

Turf uses **kilometers** internally. Multiply by 1000 for meters.

```ts
// distance in meters
const distM = pointToLineDistance(pt, line, { units: "kilometers" }) * 1000;

// line length
const km = length(line, { units: "kilometers" });
const display = km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
```

## Path Check Pattern

```ts
// src/gis/pathCheck.ts
import pointToLineDistance from "@turf/point-to-line-distance";
import length from "@turf/length";
import { lineString, point } from "@turf/helpers";
import type { Patch } from "../types/patch";

export const PATH_CHECK_BUFFER_M = 15;

export interface PathCheckResult {
  distanceMeters: number;
  nearby: Patch[];
  difficultCount: number;
  cautionCount: number;
  easyCount: number;
  rating: "clear" | "caution" | "difficult";
  summary: string;
}

export function runPathCheck(
  coords: [number, number][],
  patches: Patch[]
): PathCheckResult {
  const line = lineString(coords);
  const distanceMeters = length(line, { units: "kilometers" }) * 1000;

  const nearby = patches.filter((p) => {
    const pt = point(p.geometry.coordinates);
    const d = pointToLineDistance(pt, line, { units: "kilometers" }) * 1000;
    return d <= PATH_CHECK_BUFFER_M;
  });

  const difficultCount = nearby.filter(p => p.properties.severity === "difficult").length;
  const cautionCount   = nearby.filter(p => p.properties.severity === "caution").length;
  const easyCount      = nearby.filter(p => p.properties.severity === "easy").length;

  const rating: PathCheckResult["rating"] =
    difficultCount > 0 ? "difficult" :
    cautionCount   > 0 ? "caution"   : "clear";

  const summary = buildSummary(rating, difficultCount, cautionCount);

  return { distanceMeters, nearby, difficultCount, cautionCount, easyCount, rating, summary };
}

function buildSummary(
  rating: PathCheckResult["rating"],
  difficult: number,
  caution: number
): string {
  if (rating === "clear") return "Looks pleasantly uneventful.";
  const issues = difficult + caution;
  return `${issues} potential barrier${issues !== 1 ? "s" : ""} close to this path.`;
}
```

## Measurement Pattern

```ts
// src/gis/measure.ts
import length from "@turf/length";
import { lineString } from "@turf/helpers";
import type { Position } from "geojson";

export function measurePath(coords: Position[]): { meters: number; label: string } {
  if (coords.length < 2) return { meters: 0, label: "0 m" };
  const km = length(lineString(coords), { units: "kilometers" });
  const meters = km * 1000;
  const label = meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
  return { meters, label };
}
```

## Bounding Box Pattern

```ts
// src/gis/bbox.ts
import bbox from "@turf/bbox";
import { featureCollection } from "@turf/helpers";
import type { Patch } from "../types/patch";
import type { BBox } from "geojson";

export function patchesBBox(patches: Patch[]): BBox | null {
  if (patches.length === 0) return null;
  return bbox(featureCollection(patches));
}
```

## Testing Pattern

```ts
// src/gis/__tests__/pathCheck.test.ts
import { describe, it, expect } from "vitest";
import { runPathCheck, PATH_CHECK_BUFFER_M } from "../pathCheck";
import type { Patch } from "../../types/patch";

function makePatch(coords: [number, number], severity: Patch["properties"]["severity"]): Patch {
  return {
    id: crypto.randomUUID(),
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: {
      title: "Test", category: "other", severity, status: "observed",
      notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    },
  };
}

describe("runPathCheck", () => {
  const path: [number, number][] = [[-122.335, 47.608], [-122.334, 47.609]];

  it("rates 'clear' when no patches are nearby", () => {
    const result = runPathCheck(path, []);
    expect(result.rating).toBe("clear");
    expect(result.nearby).toHaveLength(0);
  });

  it("rates 'difficult' when a difficult patch is within buffer", () => {
    const patch = makePatch([-122.3345, 47.6085], "difficult");
    const result = runPathCheck(path, [patch]);
    expect(result.rating).toBe("difficult");
  });

  it("excludes patches beyond buffer distance", () => {
    const farPatch = makePatch([-122.400, 47.700], "difficult");
    const result = runPathCheck(path, [farPatch]);
    expect(result.nearby).toHaveLength(0);
    expect(result.rating).toBe("clear");
  });
});
```

Run with: `npx vitest run src/gis`

## Common Mistakes

- Using screen coordinates instead of geographic coordinates — always use `[lng, lat]` GeoJSON order.
- Forgetting to multiply Turf km result by 1000 before comparing to the 15 m buffer.
- Using the Turf barrel import (`@turf/turf`) — prefer individual packages for smaller bundles.
- Mutating the `patches` array inside a GIS function — always return a new array.
