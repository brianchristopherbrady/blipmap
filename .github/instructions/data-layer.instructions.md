---
applyTo: "src/data/**"
description: "Use when modifying IndexedDB schema, CRUD operations, seed data, GeoJSON import validation, or export serialization."
---

# Data Layer Conventions

## DB Version Rule

Bump `DB_VERSION` in `src/data/db.ts` on **every** schema change:

```ts
const DB_VERSION = 2; // increment this whenever the schema changes

function upgrade(db: IDBPDatabase<BlipDB>, oldVersion: number) {
  if (oldVersion < 1) {
    db.createObjectStore("patches", { keyPath: "id" });
    db.createObjectStore("meta");
  }
  if (oldVersion < 2) {
    // migration: provide defaults for existing records
  }
}
```

Never rename an object store or drop a field without a migration branch.

## CRUD Function Signatures

```ts
getPatches(): Promise<Patch[]>
getPatch(id: string): Promise<Patch | undefined>
savePatch(patch: Patch): Promise<void>
updatePatch(patch: Patch): Promise<void>
deletePatch(id: string): Promise<void>
clearPatches(): Promise<void>
```

All IndexedDB errors must be caught and re-thrown with a meaningful message.

## Seed Guard

```ts
const seeded = await db.get("meta", "seedCompleted");
if (seeded) return;
// ... insert patches ...
await db.put("meta", true, "seedCompleted");
```

Never remove the guard. Never check by patch count — use the flag.

## Import Validation

Coerce unknown fields to safe defaults rather than rejecting the whole file:

```ts
const category = VALID_CATEGORIES.includes(raw?.properties?.category)
  ? raw.properties.category : "other";
```

Assign a new `crypto.randomUUID()` to any imported record missing a valid `id`.

## Export

GeoJSON export serializes the raw `Patch[]` as a `FeatureCollection`.
Filename must use today's date: `blipmap-patches-${new Date().toISOString().slice(0, 10)}.geojson`
