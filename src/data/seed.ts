import type { Patch } from "../types/patch";
import { savePatch, getMeta, setMeta } from "./db";

const SEED_PATCHES: Patch[] = [
  {
    id: "seed-1",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3376, 47.6062] },
    properties: {
      title: "Missing curb cut",
      category: "curb-ramp",
      severity: "difficult",
      status: "observed",
      notes: "SW corner has no ramp. Wheelchair users must use the street.",
      createdAt: "2026-01-15T10:00:00Z",
      updatedAt: "2026-01-15T10:00:00Z",
    },
  },
  {
    id: "seed-2",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3351, 47.6078] },
    properties: {
      title: "Sidewalk narrows at construction",
      category: "construction",
      severity: "caution",
      status: "observed",
      notes: "Scaffolding reduces walkway to ~60 cm. Tight for wheelchairs.",
      createdAt: "2026-01-15T10:05:00Z",
      updatedAt: "2026-01-15T10:05:00Z",
    },
  },
  {
    id: "seed-3",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3328, 47.6045] },
    properties: {
      title: "Steep entrance ramp",
      category: "entrance",
      severity: "caution",
      status: "observed",
      notes: "Steeper than ADA standard. Manageable but notable.",
      createdAt: "2026-01-15T10:10:00Z",
      updatedAt: "2026-01-15T10:10:00Z",
    },
  },
  {
    id: "seed-4",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3365, 47.6090] },
    properties: {
      title: "Smooth curb cut — good example",
      category: "curb-ramp",
      severity: "easy",
      status: "verified",
      notes: "Well-maintained, flush with pavement.",
      createdAt: "2026-01-15T10:15:00Z",
      updatedAt: "2026-01-15T10:15:00Z",
    },
  },
  {
    id: "seed-5",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3340, 47.6055] },
    properties: {
      title: "Rough pavement patch",
      category: "surface",
      severity: "caution",
      status: "observed",
      notes: "Utility cut repair left uneven surface. Rough for wheels.",
      createdAt: "2026-01-15T10:20:00Z",
      updatedAt: "2026-01-15T10:20:00Z",
    },
  },
  {
    id: "seed-6",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3358, 47.6068] },
    properties: {
      title: "Accessible side entrance",
      category: "entrance",
      severity: "easy",
      status: "verified",
      notes: "Level entrance on the north side. Automatic door opener.",
      createdAt: "2026-01-15T10:25:00Z",
      updatedAt: "2026-01-15T10:25:00Z",
    },
  },
  {
    id: "seed-7",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3345, 47.6082] },
    properties: {
      title: "Stairs only — no ramp",
      category: "stairs",
      severity: "difficult",
      status: "observed",
      notes: "6 steps to building entrance. No alternative accessible route.",
      createdAt: "2026-01-15T10:30:00Z",
      updatedAt: "2026-01-15T10:30:00Z",
    },
  },
  {
    id: "seed-8",
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.3370, 47.6073] },
    properties: {
      title: "Wide accessible crossing",
      category: "crossing",
      severity: "easy",
      status: "verified",
      notes: "Audible signal, wide crossing, good sight lines.",
      createdAt: "2026-01-15T10:35:00Z",
      updatedAt: "2026-01-15T10:35:00Z",
    },
  },
];

export async function seedIfNeeded(): Promise<void> {
  const seeded = await getMeta("seedCompleted");
  if (seeded) return;
  for (const patch of SEED_PATCHES) {
    await savePatch(patch);
  }
  await setMeta("seedCompleted", true);
}
