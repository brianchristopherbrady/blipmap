export type PatchCategory =
  | "curb-ramp"
  | "stairs"
  | "obstruction"
  | "surface"
  | "crossing"
  | "entrance"
  | "construction"
  | "good-passage"
  | "elevator"
  | "other";

export type PatchSeverity = "easy" | "caution" | "difficult";
export type PatchStatus = "observed" | "verified" | "resolved";

export interface PatchSource {
  provider: "project-sidewalk-seattle";
  sourceId: string;
  labelType: string;
  importedAt: string;
  averageImageDate: string | null;
  averageLabelDate: string | null;
  medianSeverity: number | null;
  clusterSize: number | null;
  agreeCount: number | null;
  disagreeCount: number | null;
  unsureCount: number | null;
}

export interface Patch {
  id: string;
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    title: string;
    category: PatchCategory;
    severity: PatchSeverity;
    status: PatchStatus;
    notes: string;
    photo?: string;
    source?: PatchSource | null;
    createdAt: string;
    updatedAt: string;
  };
}

export type MapMode = "browse" | "add" | "measure" | "path-check" | "route";

export const CATEGORY_LABELS: Record<PatchCategory, string> = {
  "curb-ramp": "Curb / Ramp",
  stairs: "Stairs",
  obstruction: "Obstruction",
  surface: "Surface",
  crossing: "Crossing",
  entrance: "Entrance",
  construction: "Construction",
  "good-passage": "Good Passage",
  elevator: "Elevator",
  other: "Other",
};

export const SEVERITY_LABELS: Record<PatchSeverity, string> = {
  easy: "Easy",
  caution: "Caution",
  difficult: "Difficult",
};

export const STATUS_LABELS: Record<PatchStatus, string> = {
  observed: "Observed",
  verified: "Verified",
  resolved: "Resolved",
};

export const VALID_CATEGORIES: PatchCategory[] = [
  "curb-ramp", "stairs", "obstruction", "surface", "crossing",
  "entrance", "construction", "good-passage", "elevator", "other",
];
export const VALID_SEVERITIES: PatchSeverity[] = ["easy", "caution", "difficult"];
export const VALID_STATUSES: PatchStatus[] = ["observed", "verified", "resolved"];
