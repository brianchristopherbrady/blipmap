---
applyTo: "src/gis/**"
description: "Use when writing spatial analysis code: pure function requirements, Turf.js import patterns, unit conversions, Path Check logic, and Vitest test conventions."
---

# GIS Function Conventions

## Pure Functions Only

Every function in `src/gis/` must be pure:
- No imports from `src/components/`, `src/data/`, or any React module
- No side effects — never mutate inputs
- Same inputs always produce same outputs

## Turf Import Pattern

```ts
// Import from individual packages — never the barrel (@turf/turf)
import length from "@turf/length";
import pointToLineDistance from "@turf/point-to-line-distance";
import bbox from "@turf/bbox";
import { featureCollection, lineString, point } from "@turf/helpers";
import type { Feature, LineString, Position } from "geojson";
```

## Unit Conversions

Turf internally uses kilometers. Always convert for display and comparisons:

```ts
const km = length(line, { units: "kilometers" });
const meters = km * 1000;
const label = meters < 1000 ? `${Math.round(meters)} m` : `${km.toFixed(2)} km`;

// Path Check buffer: 15 meters
const distM = pointToLineDistance(pt, line, { units: "kilometers" }) * 1000;
const nearby = distM <= 15;
```

## Test File Location

```
src/gis/__tests__/<function-name>.test.ts
```

Every new or modified GIS function requires tests covering:
1. Happy path with realistic coordinates
2. Empty input (no patches, single point, etc.)
3. Boundary condition (exactly at buffer distance, exactly 0 m)

## No `any` Types

Use `Patch`, `GeoJSON.Feature`, `Position`, or specific Turf return types.
