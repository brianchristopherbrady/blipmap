import type { Patch, PatchCategory, PatchSource } from "../types/patch";

export const SEATTLE_BOUNDS = [-122.459, 47.481, -122.224, 47.735] as const;
export const SEATTLE_SOURCE_URL = "https://sidewalk-sea.cs.washington.edu/api";

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
  if (!source || source.provider !== "project-sidewalk-seattle"
    || typeof source.sourceId !== "string" || !/^\d+$/.test(source.sourceId)
    || typeof source.labelType !== "string" || !Object.prototype.hasOwnProperty.call(BARRIERS, source.labelType)
    || !date(source.importedAt)) return null;
  return {
    provider: "project-sidewalk-seattle",
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
  const collection = record(raw);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Seattle data is not a GeoJSON FeatureCollection.");
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
      || coordinates[0] < SEATTLE_BOUNDS[0] || coordinates[0] > SEATTLE_BOUNDS[2]
      || coordinates[1] < SEATTLE_BOUNDS[1] || coordinates[1] > SEATTLE_BOUNDS[3]
      || !properties || typeof labelType !== "string" || !Object.prototype.hasOwnProperty.call(BARRIERS, labelType)
      || sourceId === null || seen.has(String(sourceId))) {
      skipped++;
      continue;
    }
    seen.add(String(sourceId));
    const barrier = BARRIERS[labelType];
    const source = parsePatchSource({
      provider: "project-sidewalk-seattle", sourceId: String(sourceId), labelType, importedAt,
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
      id: `project-sidewalk-seattle:${sourceId}`,
      type: "Feature",
      geometry: { type: "Point", coordinates: [coordinates[0], coordinates[1]] },
      properties: {
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