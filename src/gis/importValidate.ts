import type { Patch, PatchCategory, PatchSeverity, PatchStatus } from "../types/patch";
import { VALID_CATEGORIES, VALID_SEVERITIES, VALID_STATUSES } from "../types/patch";
import { parsePatchSource } from "./seattleBaseline";

export interface ImportResult {
  patches: Patch[];
  skipped: number;
}

function coercePatch(raw: unknown): Patch | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  if (r["type"] !== "Feature") return null;

  const geom = r["geometry"] as Record<string, unknown> | undefined;
  if (!geom || geom["type"] !== "Point") return null;
  const coords = geom["coordinates"] as unknown[];
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords as number[];
  if (typeof lng !== "number" || typeof lat !== "number") return null;

  const props = ((r["properties"] ?? {}) as Record<string, unknown>);
  const now = new Date().toISOString();

  const category: PatchCategory = VALID_CATEGORIES.includes(props["category"] as PatchCategory)
    ? (props["category"] as PatchCategory) : "other";
  const severity: PatchSeverity = VALID_SEVERITIES.includes(props["severity"] as PatchSeverity)
    ? (props["severity"] as PatchSeverity) : "caution";
  const status: PatchStatus = VALID_STATUSES.includes(props["status"] as PatchStatus)
    ? (props["status"] as PatchStatus) : "observed";
  const source = parsePatchSource(props["source"]);
  const importedId = r["id"] ?? props["id"];

  return {
    id: source ? `project-sidewalk-seattle:${source.sourceId}`
      : (typeof importedId === "string" && importedId) ? importedId : crypto.randomUUID(),
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      title: typeof props["title"] === "string" && props["title"].trim()
        ? props["title"].trim() : "Imported patch",
      category,
      severity,
      status,
      notes: typeof props["notes"] === "string" ? props["notes"] : "",
      source,
      createdAt: typeof props["createdAt"] === "string" ? props["createdAt"] : now,
      updatedAt: now,
    },
  };
}

export function validateGeoJSON(raw: unknown): ImportResult {
  if (!raw || typeof raw !== "object") throw new Error("Not valid JSON.");

  const data = raw as Record<string, unknown>;
  let features: unknown[];

  if (data["type"] === "FeatureCollection" && Array.isArray(data["features"])) {
    features = data["features"];
  } else if (data["type"] === "Feature") {
    features = [data];
  } else {
    throw new Error("Not a valid GeoJSON FeatureCollection or Feature.");
  }

  const patches: Patch[] = [];
  let skipped = 0;
  for (const f of features) {
    const p = coercePatch(f);
    p ? patches.push(p) : skipped++;
  }

  return { patches, skipped };
}
