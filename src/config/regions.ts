import type { Polygon, MultiPolygon } from "geojson";
import type { OrsProfileKey } from "./routing";
import { VALID_CATEGORIES, type Patch, type PatchCategory } from "../types/patch";

export interface DatasetConfig {
  id: string;
  regionId: string;
  name: string;
  adapter: "project-sidewalk" | "portland-curb-ramps" | "unconfigured";
  endpoint: string | null;
  informationUrl: string | null;
  attribution: string | null;
  license: { id: string; url: string | null; scope: string } | null;
  coverage: string;
  validationBounds: [number, number, number, number] | null;
  refreshMs: number;
  retryMs: number;
  staleAfterMs: number;
  version: string | null;
  storageKey: string;
}

export interface RegionConfig {
  id: string;
  name: string;
  jurisdiction: { countryCode: string | null; subdivision: string | null };
  boundary: {
    kind: "operational-envelope";
    bbox: [number, number, number, number];
    authoritativeGeometry: Polygon | MultiPolygon | null;
  };
  map: { center: [number, number]; zoom: number };
  timeZone: string;
  locale: string;
  units: "metric" | "imperial";
  routingModes: OrsProfileKey[];
  issueCategories: PatchCategory[];
  sources: DatasetConfig[];
  features: { automaticImports: boolean; communityPublishing: boolean; aiEvidence: boolean };
}

const day = 24 * 60 * 60 * 1000;
export const DEFAULT_REGION_ID = "seattle";
export const UNASSIGNED_REGION_ID = "unassigned";

export const REGIONS: RegionConfig[] = [
  {
    id: "seattle", name: "Seattle",
    jurisdiction: { countryCode: "us", subdivision: "US-WA" },
    boundary: { kind: "operational-envelope", bbox: [-122.46, 47.48, -122.22, 47.78], authoritativeGeometry: null },
    map: { center: [-122.335, 47.608], zoom: 14 },
    timeZone: "America/Los_Angeles", locale: "en-US", units: "metric",
    routingModes: ["foot-walk", "foot-hike", "wheelchair", "cycling"], issueCategories: [...VALID_CATEGORIES],
    features: { automaticImports: true, communityPublishing: false, aiEvidence: false },
    sources: [{
      id: "project-sidewalk-seattle", regionId: "seattle", name: "Project Sidewalk Seattle",
      adapter: "project-sidewalk",
      endpoint: "https://sidewalk-sea.cs.washington.edu/v3/api/labelClusters?filetype=geojson&bbox=-122.34,47.60,-122.33,47.61&labelType=NoCurbRamp,Obstacle,SurfaceProblem,NoSidewalk",
      informationUrl: "https://sidewalk-sea.cs.washington.edu/api",
      attribution: "Project Sidewalk", license: { id: "CC0", url: null, scope: "Observation data only; excludes imagery" },
      coverage: "Downtown Seattle preview", validationBounds: [-122.459, 47.481, -122.224, 47.735],
      refreshMs: day, retryMs: day / 24, staleAfterMs: day, version: "v3", storageKey: "seattle",
    }],
  },
  {
    id: "portland", name: "Portland",
    jurisdiction: { countryCode: "us", subdivision: "US-OR" },
    boundary: { kind: "operational-envelope", bbox: [-122.84, 45.43, -122.47, 45.66], authoritativeGeometry: null },
    map: { center: [-122.6765, 45.5231], zoom: 14 },
    timeZone: "America/Los_Angeles", locale: "en-US", units: "metric",
    routingModes: ["foot-walk", "foot-hike", "wheelchair", "cycling"], issueCategories: [...VALID_CATEGORIES],
    features: { automaticImports: true, communityPublishing: false, aiEvidence: false },
    sources: [{
      id: "portland-curb-ramps", regionId: "portland", name: "PBOT curb ramp inventory",
      adapter: "portland-curb-ramps",
      endpoint: "https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61/query",
      informationUrl: "https://www.portlandmaps.com/metadata/index.cfm?action=DisplayLayer&LayerID=52778",
      attribution: "City of Portland, Bureau of Transportation",
      license: { id: "Portland data policy", url: "https://www.portlandmaps.com/metadata/index.cfm?action=DisplayLayer&LayerID=52778", scope: "Available for public use under the City of Portland Data Distribution Policy; provided as is, without warranties of accuracy" },
      coverage: "Ramps recorded without detectable warnings; observation dates unknown",
      validationBounds: [-122.84, 45.43, -122.47, 45.66], refreshMs: 7 * day, retryMs: day / 24,
      staleAfterMs: 7 * day, version: null, storageKey: "source:portland:curb-ramps",
    }],
  },
  {
    id: UNASSIGNED_REGION_ID, name: "Other locations",
    jurisdiction: { countryCode: null, subdivision: null },
    boundary: { kind: "operational-envelope", bbox: [-180, -90, 180, 90], authoritativeGeometry: null },
    map: { center: [0, 0], zoom: 2 }, timeZone: "UTC", locale: "en-US", units: "metric",
    routingModes: ["foot-walk", "foot-hike", "wheelchair", "cycling"], issueCategories: [...VALID_CATEGORIES], sources: [],
    features: { automaticImports: false, communityPublishing: false, aiEvidence: false },
  },
];

export function getRegion(id: string): RegionConfig {
  const region = REGIONS.find(candidate => candidate.id === id);
  if (!region) throw new Error(`Unknown region: ${id}`);
  return region;
}

export function getDataset(id: string): DatasetConfig | undefined {
  return REGIONS.flatMap(region => region.sources).find(source => source.id === id);
}

export function withinBounds(coords: readonly number[], bounds: readonly number[]): boolean {
  return coords.length === 2 && coords.every(Number.isFinite)
    && coords[0] >= bounds[0] && coords[0] <= bounds[2] && coords[1] >= bounds[1] && coords[1] <= bounds[3];
}

export function inferRegion(coords: readonly number[]): string {
  return REGIONS.find(region => region.id !== UNASSIGNED_REGION_ID && withinBounds(coords, region.boundary.bbox))?.id ?? UNASSIGNED_REGION_ID;
}

export function patchRegion(patch: Patch): string {
  return inferRegion(patch.geometry.coordinates);
}

export function datasetFreshness(source: DatasetConfig, lastSuccess: string | null, now: number): "unknown" | "fresh" | "stale" {
  const checked = lastSuccess ? Date.parse(lastSuccess) : NaN;
  if (!Number.isFinite(checked) || checked > now) return "unknown";
  return now - checked < source.staleAfterMs ? "fresh" : "stale";
}