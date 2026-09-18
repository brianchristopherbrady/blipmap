import { describe, expect, it } from "vitest";
import { getNonDrivingProfile, isNonDrivingProfile } from "../routing";

describe("non-driving route profiles", () => {
  it.each([
    ["wheelchair", "wheelchair"],
    ["foot-walk", "foot-walking"],
    ["foot-hike", "foot-hiking"],
    ["cycling", "cycling-regular"],
  ])("maps %s to the matching provider access rules", (profile, expected) => {
    expect(isNonDrivingProfile(profile)).toBe(true);
    expect(getNonDrivingProfile(profile)).toBe(expected);
  });

  it.each(["driving-car", "driving-hgv", "car", "motorcycle", "constructor", "__proto__", "toString", "", null, undefined, {}])(
    "rejects unsupported or corrupted profile %s", profile => {
      expect(isNonDrivingProfile(profile)).toBe(false);
      expect(() => getNonDrivingProfile(profile)).toThrow("Driving routes are not supported");
    },
  );
});