import { describe, expect, it } from "vitest";
import { datasetFreshness, DEFAULT_REGION_ID, getRegion, inferRegion, REGIONS, withinBounds } from "../regions";

describe("region configuration", () => {
  it("keeps Seattle as the default and defines distinct stable regions", () => {
    expect(DEFAULT_REGION_ID).toBe("seattle");
    expect(new Set(REGIONS.map(region => region.id)).size).toBe(REGIONS.length);
    for (const region of REGIONS) {
      expect(withinBounds(region.map.center, region.boundary.bbox)).toBe(true);
      expect(() => new Intl.DateTimeFormat(region.locale, { timeZone: region.timeZone })).not.toThrow();
      expect(region.routingModes).not.toContain("driving-car");
      expect(region.features.communityPublishing).toBe(false);
    }
    expect(() => getRegion("unknown")).toThrow("Unknown region");
  });
  it("isolates Seattle, Portland, and unassigned geometry without guessing jurisdiction", () => {
    expect(inferRegion([-122.335, 47.608])).toBe("seattle");
    expect(inferRegion([-122.6765, 45.5231])).toBe("portland");
    expect(inferRegion([0, 0])).toBe("unassigned");
    expect(withinBounds([NaN, 45.5], getRegion("portland").boundary.bbox)).toBe(false);
    expect(getRegion("portland").boundary.authoritativeGeometry).toBeNull();
  });
  it("uses the verified Portland municipal service with its own reuse terms", () => {
    const region = getRegion("portland");
    expect(region.features.automaticImports).toBe(true);
    expect(region.sources[0]).toMatchObject({ adapter: "portland-curb-ramps", version: null, refreshMs: 7 * 86400000 });
    expect(region.sources[0].endpoint).toBe("https://www.portlandmaps.com/od/rest/services/COP_OpenData_Transportation/MapServer/61/query");
    expect(region.sources[0].license?.id).not.toBe("CC0");
    expect(region.sources[0].license?.url).toContain("LayerID=52778");
  });
  it("distinguishes fetch freshness from unknown or future timestamps", () => {
    const source = getRegion("seattle").sources[0];
    const now = Date.parse("2026-09-21T12:00:00Z");
    expect(datasetFreshness(source, null, now)).toBe("unknown");
    expect(datasetFreshness(source, "2026-09-22", now)).toBe("unknown");
    expect(datasetFreshness(source, "2026-09-21T11:00:00Z", now)).toBe("fresh");
    expect(datasetFreshness(source, "2026-09-19", now)).toBe("stale");
  });
});