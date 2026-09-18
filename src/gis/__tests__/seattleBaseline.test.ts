import { describe, expect, it } from "vitest";
import { convertSeattleBaseline, parsePatchSource, SEATTLE_BOUNDS } from "../seattleBaseline";
import { validateGeoJSON } from "../importValidate";

const importedAt = "2026-09-17T12:00:00Z";
function feature(properties: Record<string, unknown> = {}, coordinates: unknown = [-122.335, 47.608]) {
  return {
    type: "Feature", geometry: { type: "Point", coordinates },
    properties: {
      label_cluster_id: 124, label_type: "NoCurbRamp", median_severity: 3,
      avg_image_capture_date: "2019-06-01T00:00:00Z", avg_label_date: "2023-01-01T00:00:00Z",
      cluster_size: 2, agree_count: 9, disagree_count: 1, unsure_count: 0,
      ...properties,
    },
  };
}
function convert(features: unknown[]) {
  return convertSeattleBaseline({ type: "FeatureCollection", features }, importedAt);
}

describe("Seattle baseline conversion", () => {
  it("preserves provenance without claiming local verification or a recent survey", () => {
    const raw = feature();
    const snapshot = JSON.stringify(raw);
    const patch = convert([raw]).patches[0];
    expect(patch.id).toBe("project-sidewalk-seattle:124");
    expect(patch.properties).toMatchObject({ category: "curb-ramp", severity: "difficult", status: "observed" });
    expect(patch.properties.source).toMatchObject({
      sourceId: "124", averageImageDate: "2019-06-01T00:00:00Z", agreeCount: 9, importedAt,
    });
    expect(JSON.stringify(raw)).toBe(snapshot);
    expect(convert([raw])).toEqual(convert([raw]));
  });

  it.each([1, 2, null, 0, 5])("does not call a barrier easy for source severity %s", (severity) => {
    expect(convert([feature({ median_severity: severity })]).patches[0].properties.severity).toBe("caution");
  });

  it("accepts empty data without inventing missing ramps", () => {
    expect(convert([])).toEqual({ patches: [], skipped: 0 });
    expect(convert([feature({ label_type: "CurbRamp" }), feature({ label_type: "unknown" })]).patches).toEqual([]);
  });

  it("rejects invalid geometry, IDs, and records outside the Seattle bounds", () => {
    const result = convert([
      null, feature({}, [0, 0]), feature({}, [NaN, 47.6]), feature({}, [-122.3, Infinity]),
      feature({}, ["-122.3", 47.6]), feature({ label_cluster_id: null }), feature({ label_type: "constructor" }),
    ]);
    expect(result).toEqual({ patches: [], skipped: 7 });
  });

  it("accepts boundary coordinates and deduplicates source IDs", () => {
    const raw = feature({}, [SEATTLE_BOUNDS[0], SEATTLE_BOUNDS[1]]);
    expect(convert([raw, raw]).patches).toHaveLength(1);
    expect(convert([raw, raw]).skipped).toBe(1);
  });

  it("does not turn absent or invalid metadata into confirmation", () => {
    const patch = convert([feature({ agree_count: null, disagree_count: -1, avg_image_capture_date: "bad" })]).patches[0];
    expect(patch.properties.source).toMatchObject({ agreeCount: null, disagreeCount: null, averageImageDate: null });
    expect(parsePatchSource({ provider: "untrusted" })).toBeNull();
  });

  it("rejects unexpected response shapes", () => {
    expect(() => convertSeattleBaseline({ error: "offline" }, importedAt)).toThrow("FeatureCollection");
  });

  it("preserves source metadata and identity through GeoJSON export/import", () => {
    const patch = convert([feature()]).patches[0];
    const exported = JSON.parse(JSON.stringify({ type: "FeatureCollection", features: [patch] }));
    const imported = validateGeoJSON(exported).patches[0];
    expect(imported.id).toBe(patch.id);
    expect(imported.properties.source).toEqual(patch.properties.source);
  });
});