import { describe, expect, it } from "vitest";
import { getRegion, type DatasetConfig } from "../../config/regions";
import { convertPortlandRecord } from "../portlandBaseline";
import { validateGeoJSON } from "../importValidate";

const config: DatasetConfig = { ...getRegion("portland").sources[0], adapter: "portland-curb-ramps", validationBounds: getRegion("portland").boundary.bbox };
const record = { attributes: { OBJECTID: 137, NonAssetID: "0001-0000158", ADAWarnings: "N" }, geometry: { x: -122.6932492348886, y: 45.518015216712406 } };

describe("Portland municipal warning-surface observations", () => {
  it("uses the stable municipal ID and preserves the limited meaning of a real source record", () => {
    const patch = convertPortlandRecord(record, "2026-09-22T12:00:00Z", config);
    expect(patch.id).toBe(`${config.id}:0001-0000158`);
    expect(patch.properties).toMatchObject({ category: "curb-ramp", severity: "caution", status: "observed", regionId: "portland" });
    expect(patch.properties.source).toMatchObject({ averageLabelDate: null, averageImageDate: null, labelType: "NoDetectableWarning" });
    expect(patch.properties.notes).toContain("not a missing-ramp report");
    expect(convertPortlandRecord({ ...record, attributes: { ...record.attributes, OBJECTID: 999 } }, "2026-09-23", config).id).toBe(patch.id);
  });
  it("rejects yes, unknown, null and undocumented warning codes rather than inventing issues", () => {
    for (const ADAWarnings of ["Y", "U", null, "", "X"]) {
      expect(() => convertPortlandRecord({ ...record, attributes: { ...record.attributes, ADAWarnings } }, "2026-09-22", config)).toThrow();
    }
  });
  it("rejects malformed records, invalid IDs, coordinates and dates", () => {
    for (const value of [null, {}, { ...record, geometry: { x: -122.335, y: 47.608 } },
      { ...record, geometry: { x: NaN, y: 45.52 } }, { ...record, attributes: { ...record.attributes, NonAssetID: "" } }]) {
      expect(() => convertPortlandRecord(value, "2026-09-22", config)).toThrow();
    }
    expect(() => convertPortlandRecord(record, "invalid", config)).toThrow();
  });
  it("accepts the inclusive configured boundary", () => {
    const [west, south] = config.validationBounds!;
    expect(convertPortlandRecord({ ...record, geometry: { x: west, y: south } }, "2026-09-22", config).geometry.coordinates).toEqual([west, south]);
  });
  it("round-trips provenance without turning municipal records into imagery claims", () => {
    const patch = convertPortlandRecord(record, "2026-09-22", getRegion("portland").sources[0]);
    const restored = validateGeoJSON({ type: "FeatureCollection", features: [patch] }).patches[0];
    expect(restored.id).toBe(patch.id);
    expect(restored.properties.source).toEqual(patch.properties.source);
  });
});