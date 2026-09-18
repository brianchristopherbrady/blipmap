import { describe, expect, it } from "vitest";
import { routingOptions } from "../accessRequirements";
import { normalizeProfile } from "../../data/profile";

describe("independent access requirements", () => {
  it("does not pretend wheelchair defaults guarantee flush crossings", () => {
    expect(() => routingOptions(normalizeProfile({ routingProfile: "wheelchair", requireStepFree: true }))).toThrow("step-free crossings");
  });
  it("rejects unsupported incline limits rather than rounding upwards", () => {
    expect(() => routingOptions(normalizeProfile({ routingProfile: "wheelchair", maximumInclinePercent: 2 }))).toThrow("supported limits");
  });
  it.each(["foot-walk", "foot-hike", "cycling", "wheelchair"])("excludes steps for %s when required", routingProfile => {
    expect(routingOptions(normalizeProfile({ routingProfile, avoidStairs: true }))).toMatchObject({ avoid_features: ["steps"] });
  });
  it("migrates single aids and keeps requirements with multiple aids", () => {
    expect(normalizeProfile({ mobilityAid: "cane" }).mobilityAids).toEqual(["cane"]);
    const profile = normalizeProfile({ mobilityAids: ["wheelchair", "cane", "cane", "bad"], routingProfile: "foot-walk", avoidStairs: true });
    expect(profile.mobilityAids).toEqual(["wheelchair", "cane"]);
    expect(profile.routingProfile).toBe("foot-walk");
    expect(routingOptions(profile)).toEqual({ avoid_features: ["steps"] });
  });
  it("sends wheelchair-specific width and slope restrictions", () => {
    expect(routingOptions(normalizeProfile({ routingProfile: "wheelchair", minimumWidthM: 0.9, maximumInclinePercent: 6, avoidSteepSlopes: true, avoidRoughSurfaces: true })))
      .toMatchObject({ profile_params: { restrictions: { minimum_width: 0.9, maximum_incline: 3, smoothness_type: "excellent" } } });
  });
  it.each(["avoidConstruction", "avoidRoughSurfaces", "requireStepFree", "avoidSteepSlopes"])("does not silently discard unsupported walking requirement %s", requirement => {
    expect(() => routingOptions(normalizeProfile({ [requirement]: true }))).toThrow("No route was generated");
  });
});