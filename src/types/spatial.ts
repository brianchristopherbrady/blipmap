import type { Point, LineString, Polygon } from "geojson";
import type { Patch, PatchCategory } from "./patch";

export type SpatialGeometry = Point | LineString | Polygon;
export type VerificationStatus = "submitted" | "provisionally-visible" | "confirmed" | "disputed" | "needs-review" | "superseded" | "resolved" | "rejected";
export type FeatureKind = "sidewalk" | "crossing" | "curb-ramp" | "stairs" | "elevator" | "trail" | "bike-lane" | "entrance" | "unknown";

export interface AccessibilityAttributes {
  stairs: boolean | null;
  rampAvailable: boolean | null;
  gradePercent: number | null;
  crossSlopePercent: number | null;
  widthM: number | null;
  clearanceM: number | null;
  surface: string | null;
  condition: string | null;
  obstructions: string[] | null;
  trafficExposure: "protected" | "low" | "high" | null;
  lighting: boolean | null;
  temporaryClosure: boolean | null;
  accessibleSignal: boolean | null;
}

export interface PhysicalFeature {
  id: string;
  regionId: string;
  kind: FeatureKind;
  geometry: SpatialGeometry;
  association: "unmatched-observation-location" | "source-identified" | "reviewed";
}

export interface Observation {
  id: string;
  regionId: string;
  featureId: string;
  patchId: string;
  revision: number;
  observedAt: string | null;
  validFrom: string | null;
  expiresAt: string | null;
  recordedAt: string;
  source: string;
  sourceRecordId: string | null;
  confidence: number | null;
  verificationStatus: VerificationStatus;
  permanence: "permanent" | "temporary" | "unknown";
  createdBy: string | null;
  geometry: SpatialGeometry;
  attributes: AccessibilityAttributes;
  category: PatchCategory;
  supersedes: string | null;
  snapshot: Patch;
  contentKey: string;
}

export interface AdvisoryPhotoAssessment {
  advisoryOnly: true;
  model: string;
  version: string;
  assessedAt: string;
  possibleConditions: { category: PatchCategory; confidence: number }[];
  imageQualityWarnings: string[];
  contradictions: string[];
}

export interface Evidence {
  id: string;
  regionId: string;
  observationId: string;
  kind: "photo" | "source-record" | "sensor" | "note" | "ai-assessment";
  capturedAt: string | null;
  createdBy: string | null;
  content: string | null;
  assessment: AdvisoryPhotoAssessment | null;
  visibility: "device-only" | "reviewers" | "public-redacted";
}

export interface Verification {
  id: string;
  regionId: string;
  observationId: string;
  action: "confirm" | "dispute" | "review" | "ai-assessment";
  actorId: string | null;
  recordedAt: string;
  evidenceIds: string[];
  signals: { accountHistoryDays: number | null; proximityBand: "nearby" | "remote" | "unknown"; evidenceAgeDays: number | null; reviewerTrust: number | null };
  policyVersion: string;
}

export interface CurrentCondition {
  id: string;
  regionId: string;
  featureId: string;
  computedAt: string;
  policyVersion: string;
  state: "unknown" | "reported" | "confirmed" | "disputed" | "resolved";
  observationIds: string[];
  attributes: AccessibilityAttributes;
  explanation: string;
}

export interface ModerationEvent {
  id: string;
  regionId: string;
  observationId: string | null;
  action: "flag" | "review" | "merge" | "resolve" | "reject" | "source-missing" | "local-hide";
  actorId: string | null;
  recordedAt: string;
  reason: string;
  policyVersion: string;
}

export interface SourceRecord {
  id: string;
  regionId: string;
  sourceId: string;
  externalId: string;
  revision: number;
  sourceVersion: string | null;
  importedAt: string;
  payload: unknown;
  contentKey: string;
  attribution: string;
  license: string;
  previousVersionId: string | null;
}

export interface ImportReport {
  id: string;
  regionId: string;
  sourceId: string;
  importedAt: string;
  sourceVersion: string | null;
  added: number;
  modified: number;
  unchanged: number;
  apparentRemovals: string[];
  duplicates: number;
  rejected: number;
}

export interface RoutingEdge {
  id: string;
  regionId: string;
  featureIds: string[];
  mode: "pedestrian" | "wheelchair" | "bicycle";
  attributes: AccessibilityAttributes;
  lengthM: number;
  confidence: number | null;
  observedAt: string | null;
  expiresAt: string | null;
}

export interface EdgeEvaluation {
  available: boolean;
  hardConstraintFailures: string[];
  unknownAttributes: (keyof AccessibilityAttributes)[];
  cost: number | null;
  costReasons: string[];
  policyVersion: string;
}