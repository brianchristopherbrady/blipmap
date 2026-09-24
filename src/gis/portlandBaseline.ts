import { withinBounds, type DatasetConfig } from "../config/regions";
import type { Patch } from "../types/patch";

export interface PortlandRecord {
  attributes: { OBJECTID: number; NonAssetID: string; ADAWarnings: "N" };
  geometry: { x: number; y: number };
}

export function portlandRecord(value: unknown, bounds: readonly number[]): PortlandRecord {
  const feature = value as Partial<PortlandRecord> | null;
  const attributes = feature?.attributes;
  const geometry = feature?.geometry;
  if (!attributes || !Number.isSafeInteger(attributes.OBJECTID) || attributes.OBJECTID < 0
    || typeof attributes.NonAssetID !== "string" || !/^[\w-]{1,15}$/.test(attributes.NonAssetID)
    || attributes.ADAWarnings !== "N" || !geometry
    || !withinBounds([geometry.x, geometry.y], bounds)) {
    throw new Error("Invalid Portland curb-ramp record. Cached observations are unchanged.");
  }
  return feature as PortlandRecord;
}

export function convertPortlandRecord(value: unknown, importedAt: string, config: DatasetConfig): Patch {
  if (!config.validationBounds || config.adapter !== "portland-curb-ramps" || !Number.isFinite(Date.parse(importedAt))) {
    throw new Error("Invalid Portland source configuration or import date.");
  }
  const { attributes, geometry } = portlandRecord(value, config.validationBounds);
  return {
    id: `${config.id}:${attributes.NonAssetID}`, type: "Feature",
    geometry: { type: "Point", coordinates: [geometry.x, geometry.y] },
    properties: {
      regionId: config.regionId, title: "Detectable warning absent in city inventory (PBOT)",
      category: "curb-ramp", severity: "caution", status: "observed",
      notes: "Portland Bureau of Transportation records ADAWarnings=N: no detectable warning surface (such as truncated domes) at this curb ramp. This may affect people using tactile cues. Observation date is unknown; current conditions are unverified. This is not a missing-ramp report or an ADA compliance determination.",
      createdAt: importedAt, updatedAt: importedAt,
      source: { provider: config.id, sourceId: attributes.NonAssetID, labelType: "NoDetectableWarning", importedAt,
        averageImageDate: null, averageLabelDate: null, medianSeverity: null, clusterSize: null,
        agreeCount: null, disagreeCount: null, unsureCount: null },
    },
  };
}