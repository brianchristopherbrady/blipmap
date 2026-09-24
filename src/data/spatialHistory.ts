import { patchRegion } from "../config/regions";
import type { Patch } from "../types/patch";
import type { AccessibilityAttributes, CurrentCondition, Evidence, Observation, PhysicalFeature } from "../types/spatial";

export function unknownAttributes(): AccessibilityAttributes {
  return { stairs: null, rampAvailable: null, gradePercent: null, crossSlopePercent: null,
    widthM: null, clearanceM: null, surface: null, condition: null, obstructions: null,
    trafficExposure: null, lighting: null, temporaryClosure: null, accessibleSignal: null };
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter(key => record[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function observationContent(patch: Patch, sourceRecordId: string | null): string {
  const { createdAt: _created, updatedAt: _updated, source, ...properties } = patch.properties;
  const { importedAt: _imported, ...provenance } = source ?? {};
  return canonical({ geometry: patch.geometry, properties, provenance, sourceRecordId });
}

export function normalizeObservation(patch: Patch, revision: number, recordedAt: string, sourceRecordId: string | null = null): {
  feature: PhysicalFeature; observation: Observation; evidence: Evidence[];
} {
  const regionId = patchRegion(patch);
  const featureId = `${regionId}:patch:${patch.id}`;
  const id = `${featureId}:observation:${revision}`;
  const source = patch.properties.source;
  const validDate = (value: string | undefined | null) => value && Number.isFinite(Date.parse(value)) ? value : null;
  const observation: Observation = {
    id, regionId, featureId, patchId: patch.id, revision, recordedAt,
    observedAt: validDate(source?.averageLabelDate), validFrom: null, expiresAt: null,
    source: source?.provider ?? "device-local", sourceRecordId, confidence: null,
    verificationStatus: patch.properties.status === "observed" ? "provisionally-visible" : "needs-review",
    permanence: "unknown", createdBy: null, geometry: patch.geometry, attributes: unknownAttributes(),
    category: patch.properties.category, supersedes: revision > 1 ? `${featureId}:observation:${revision - 1}` : null,
    snapshot: patch, contentKey: observationContent(patch, sourceRecordId),
  };
  const evidence: Evidence[] = [];
  for (const [kind, content] of [["note", patch.properties.notes], ["photo", patch.properties.photo], ["source-record", sourceRecordId]] as const) {
    if (content) evidence.push({ id: `${id}:${kind}`, regionId, observationId: id, kind,
      capturedAt: null, createdBy: null, content, assessment: null, visibility: "device-only" });
  }
  return { feature: { id: featureId, regionId, geometry: patch.geometry, kind: "unknown", association: "unmatched-observation-location" }, observation, evidence };
}

export function deriveCondition(feature: PhysicalFeature, observations: Observation[], now: string): CurrentCondition {
  const timestamp = Date.parse(now);
  if (!Number.isFinite(timestamp)) throw new Error("Invalid condition evaluation time.");
  const relevant = observations.filter(observation => observation.featureId === feature.id && observation.regionId === feature.regionId
    && observation.verificationStatus !== "rejected"
    && Date.parse(observation.recordedAt) <= timestamp
    && (!observation.validFrom || Date.parse(observation.validFrom) <= timestamp));
  const superseded = new Set(relevant.map(observation => observation.supersedes).filter(Boolean));
  const active = relevant.filter(observation => !superseded.has(observation.id)
    && observation.verificationStatus !== "superseded"
    && (!observation.expiresAt || Date.parse(observation.expiresAt) > timestamp));
  const state = !active.length ? "unknown" : active.some(observation => observation.verificationStatus === "disputed") ? "disputed"
    : active.every(observation => observation.verificationStatus === "resolved") ? "resolved"
    : active.every(observation => observation.verificationStatus === "confirmed") ? "confirmed" : "reported";
  return { id: feature.id, regionId: feature.regionId, featureId: feature.id, computedAt: now,
    policyVersion: "local-foundation-v1", state, observationIds: active.map(observation => observation.id),
    attributes: unknownAttributes(), explanation: "Recorded claims only. Unknown attributes remain unknown; this is not an accessibility certification." };
}