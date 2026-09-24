import type { Patch, PatchCategory, PatchSource } from "../types/patch";
import { DEFAULT_REGION_ID, getDataset, getRegion, withinBounds, type DatasetConfig } from "../config/regions";

const defaultSource = getRegion(DEFAULT_REGION_ID).sources[0];
export const SEATTLE_BOUNDS = defaultSource.validationBounds!;
export const SEATTLE_SOURCE_URL = defaultSource.informationUrl!;

const BARRIERS: Record<string, { title: string; category: PatchCategory }> = {
  NoCurbRamp: { title: "Missing curb ramp", category: "curb-ramp" },
  Obstacle: { title: "Obstacle in path", category: "obstruction" },
  SurfaceProblem: { title: "Sidewalk surface problem", category: "surface" },
  NoSidewalk: { title: "Missing sidewalk", category: "other" },
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function date(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export function parsePatchSource(value: unknown): PatchSource | null {
  const source = record(value);
  if (source && typeof source.provider === "string" && getDataset(source.provider)?.adapter === "portland-curb-ramps") {
    if (typeof source.sourceId !== "string" || !/^[\w-]{1,15}$/.test(source.sourceId)
      || source.labelType !== "NoDetectableWarning" || !date(source.importedAt)) return null;
    return { provider: source.provider, sourceId: source.sourceId, labelType: source.labelType,
      importedAt: source.importedAt as string, averageImageDate: null, averageLabelDate: null,
      medianSeverity: null, clusterSize: null, agreeCount: null, disagreeCount: null, unsureCount: null };
  }
  if (!source || typeof source.provider !== "string" || getDataset(source.provider)?.adapter !== "project-sidewalk"
    || typeof source.sourceId !== "string" || !/^\d+$/.test(source.sourceId)
    || typeof source.labelType !== "string" || !Object.prototype.hasOwnProperty.call(BARRIERS, source.labelType)
    || !date(source.importedAt)) return null;
  return {
    provider: source.provider,
    sourceId: source.sourceId,
    labelType: source.labelType,
    importedAt: source.importedAt as string,
    averageImageDate: date(source.averageImageDate),
    averageLabelDate: date(source.averageLabelDate),
    medianSeverity: [1, 2, 3].includes(source.medianSeverity as number) ? source.medianSeverity as number : null,
    clusterSize: count(source.clusterSize),
    agreeCount: count(source.agreeCount),
    disagreeCount: count(source.disagreeCount),
    unsureCount: count(source.unsureCount),
  };
}

export function convertSeattleBaseline(raw: unknown, importedAt: string): { patches: Patch[]; skipped: number } {
  return convertProjectSidewalk(raw, importedAt, defaultSource);
}

export function convertProjectSidewalk(raw: unknown, importedAt: string, dataset: DatasetConfig): { patches: Patch[]; skipped: number } {
  if (!dataset.validationBounds || dataset.adapter !== "project-sidewalk") throw new Error("Source bounds and adapter are required.");
  const collection = record(raw);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Source data is not a GeoJSON FeatureCollection.");
  }
  if (!date(importedAt)) throw new Error("Invalid import date.");
  const patches: Patch[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const value of collection.features) {
    const feature = record(value);
    const geometry = record(feature?.geometry);
    const properties = record(feature?.properties);
    const coordinates = geometry?.coordinates;
    const labelType = properties?.label_type;
    const sourceId = count(properties?.label_cluster_id);
    if (feature?.type !== "Feature" || geometry?.type !== "Point"
      || !Array.isArray(coordinates) || coordinates.length !== 2
      || !coordinates.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
      || !withinBounds(coordinates as number[], dataset.validationBounds)
      || !properties || typeof labelType !== "string" || !Object.prototype.hasOwnProperty.call(BARRIERS, labelType)
      || sourceId === null || seen.has(String(sourceId))) {
      skipped++;
      continue;
    }
    seen.add(String(sourceId));
    const barrier = BARRIERS[labelType];
    const source = parsePatchSource({
      provider: dataset.id, sourceId: String(sourceId), labelType, importedAt,
      averageImageDate: properties.avg_image_capture_date,
      averageLabelDate: properties.avg_label_date,
      medianSeverity: properties.median_severity,
      clusterSize: properties.cluster_size,
      agreeCount: properties.agree_count,
      disagreeCount: properties.disagree_count,
      unsureCount: properties.unsure_count,
    });
    const tags = record(properties.tag_counts);
    const details = tags ? Object.entries(tags).filter(([, total]) => (count(total) ?? 0) > 0).map(([tag]) => tag) : [];
    patches.push({
      id: `${dataset.id}:${sourceId}`,
      type: "Feature",
      geometry: { type: "Point", coordinates: [coordinates[0], coordinates[1]] },
      properties: {
        regionId: dataset.regionId,
        title: `${barrier.title} (Project Sidewalk)`,
        category: barrier.category,
        severity: source?.medianSeverity === 3 ? "difficult" : "caution",
        status: "observed",
        notes: ["External imagery-based report; current conditions are unverified.", ...details].join("\n"),
        source,
        createdAt: importedAt,
        updatedAt: importedAt,
      },
    });
  }
  return { patches, skipped };
}