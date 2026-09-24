import { describe, expect, it } from "vitest";
import { canonical, deriveCondition, normalizeObservation, observationContent } from "../spatialHistory";
import type { Patch } from "../../types/patch";

const patch: Patch = { id: "local", type: "Feature", geometry: { type: "Point", coordinates: [-122.6765, 45.5231] },
  properties: { title: "Ramp report", category: "curb-ramp", severity: "caution", status: "verified", notes: "Check lip", photo: "data:image/jpeg;base64,fixture", createdAt: "2026-09-20", updatedAt: "2026-09-20" } };

describe("normalized history contracts", () => {
  it("separates physical association, claims, and evidence without trusting old status labels", () => {
    const result = normalizeObservation(patch, 1, "2026-09-21");
    expect(result.feature).toMatchObject({ regionId: "portland", kind: "unknown", association: "unmatched-observation-location" });
    expect(result.observation).toMatchObject({ verificationStatus: "needs-review", observedAt: null, confidence: null, createdBy: null });
    expect(Object.values(result.observation.attributes).every(value => value === null)).toBe(true);
    expect(result.evidence.map(evidence => evidence.kind)).toEqual(["note", "photo"]);
    expect(result.evidence.every(evidence => evidence.visibility === "device-only")).toBe(true);
    expect(result.observation.snapshot).toEqual(patch);
  });
  it("does not treat expired temporary claims as proof of resolution or resurrect a superseded claim", () => {
    const first = normalizeObservation(patch, 1, "2026-09-20");
    const second = normalizeObservation(patch, 2, "2026-09-21");
    second.observation.permanence = "temporary";
    second.observation.expiresAt = "2026-09-22";
    expect(deriveCondition(first.feature, [first.observation, second.observation], "2026-09-23")).toMatchObject({ state: "unknown", observationIds: [] });
  });
  it("isolates conditions by region and keeps future and rejected claims out", () => {
    const { feature, observation } = normalizeObservation(patch, 1, "2026-09-20");
    expect(deriveCondition(feature, [{ ...observation, regionId: "seattle" }], "2026-09-21").state).toBe("unknown");
    expect(deriveCondition(feature, [{ ...observation, validFrom: "2026-10-01" }], "2026-09-21").state).toBe("unknown");
    expect(deriveCondition(feature, [{ ...observation, verificationStatus: "rejected" }], "2026-09-21").state).toBe("unknown");
    expect(deriveCondition(feature, [{ ...observation, verificationStatus: "disputed" }], "2026-09-21").state).toBe("disputed");
  });
  it("keeps current claims until a non-rejected replacement becomes effective", () => {
    const first = normalizeObservation(patch, 1, "2026-09-20");
    const second = normalizeObservation(patch, 2, "2026-09-21");
    for (const replacement of [
      { ...second.observation, validFrom: "2026-10-01" },
      { ...second.observation, recordedAt: "2026-10-01" },
      { ...second.observation, verificationStatus: "rejected" as const },
    ]) {
      expect(deriveCondition(first.feature, [first.observation, replacement], "2026-09-22").observationIds).toEqual([first.observation.id]);
    }
    expect(deriveCondition(first.feature, [first.observation, { ...second.observation, validFrom: "2026-10-01" }], "2026-10-02").observationIds).toEqual([second.observation.id]);
  });
  it("compares content independently of key order and repeat download timestamps", () => {
    expect(canonical({ name: "a", id: 1 })).toBe(canonical({ id: 1, name: "a" }));
    expect(observationContent(patch, null)).toBe(observationContent({ ...patch, properties: { ...patch.properties, updatedAt: "2026-09-22" } }, null));
  });
});