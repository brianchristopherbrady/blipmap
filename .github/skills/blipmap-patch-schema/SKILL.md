---
name: blipmap-patch-schema
description: "Use when adding fields to the Patch data model, changing PatchCategory/PatchSeverity/PatchStatus types, updating IndexedDB schema, writing seed data, or handling GeoJSON import/export for Patches. Covers the full lifecycle from TypeScript types through IndexedDB migrations to UI label maps."
---

# Patch Schema & Persistence

## When to Use
- Adding or renaming a field on `Patch` or its `properties`
- Adding a new `PatchCategory`, `PatchSeverity`, or `PatchStatus` value
- Bumping the IndexedDB schema version
- Updating seed data in `src/data/seed.ts`
- Modifying GeoJSON import validation or export serialization

## Procedure

### 1. Update TypeScript Types

All Patch types live in `src/types/patch.ts` (or equivalent domain types file):

```ts
export type PatchCategory =
  | "curb-ramp" | "stairs" | "obstruction" | "surface"
  | "crossing" | "entrance" | "construction"
  | "good-passage" | "elevator" | "other";

export type PatchSeverity = "easy" | "caution" | "difficult";
export type PatchStatus = "observed" | "verified" | "resolved";

export interface Patch {
  id: string;
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    title: string;
    category: PatchCategory;
    severity: PatchSeverity;
    status: PatchStatus;
    notes: string;
    createdAt: string;  // ISO 8601
    updatedAt: string;
  };
}
```

Always use slug values internally. Display labels are derived only in the UI layer.

### 2. Update IndexedDB Schema

In `src/data/db.ts`, bump `DB_VERSION` and add a migration in `upgrade()`:

```ts
const DB_VERSION = 2; // increment on every schema change

function upgrade(db: IDBPDatabase<BlipDB>, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore("patches", { keyPath: "id" });
    db.createObjectStore("meta");
  }
  if (oldVersion < 2) {
    // add migration for new version here
  }
}
```

Never rename an object store without a migration. Never drop fields without a migration.

### 3. Update the Label Map

In the UI label map (e.g., `src/utils/labels.ts`), add display strings for new enum values:

```ts
export const CATEGORY_LABELS: Record<PatchCategory, string> = {
  "curb-ramp": "Curb / Ramp",
  "stairs": "Stairs",
  // ...
};
```

### 4. Update Seed Data

In `src/data/seed.ts`, add examples of any new category/field so the demo data remains representative.

The seed guard:
```ts
const seeded = await db.get("meta", "seedCompleted");
if (seeded) return;
// ... insert seed patches ...
await db.put("meta", true, "seedCompleted");
```

This runs once ever. Do NOT remove the guard.

### 5. Update Import Validation

In `src/gis/importValidate.ts`, ensure the validator accepts new optional fields and fills sensible defaults:

```ts
function coercePatch(raw: unknown): Patch | null {
  // validate required fields; fill defaults for optional ones
  const category = VALID_CATEGORIES.includes(raw.properties?.category)
    ? raw.properties.category
    : "other"; // safe default
  // ...
}
```

### 6. GeoJSON Export

The export in `src/data/export.ts` serializes all Patches as a `FeatureCollection`. New fields are included automatically because they live in `properties`. Verify the filename uses today's date:

```ts
const filename = `blipmap-patches-${new Date().toISOString().slice(0, 10)}.geojson`;
```

## Common Mistakes

- Forgetting to bump `DB_VERSION` after a schema change — causes silent stale-data bugs.
- Adding a required field without a migration default — breaks existing stored records.
- Using a display string (e.g., `"Curb / Ramp"`) instead of a slug (`"curb-ramp"`) in stored data.
