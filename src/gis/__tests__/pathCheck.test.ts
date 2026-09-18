import { describe, it, expect } from "vitest";
import { runPathCheck, PATH_CHECK_BUFFER_M } from "../pathCheck";
import type { Patch } from "../../types/patch";

function makePatch(coords: [number, number], severity: Patch["properties"]["severity"]): Patch {
  return {
    id: crypto.randomUUID(),
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: {
      title: "Test patch",
      category: "other",
      severity,
      status: "observed",
      notes: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

const PATH: [number, number][] = [[-122.335, 47.608], [-122.334, 47.609]];

describe("runPathCheck", () => {
  it("returns clear with no patches", () => {
    const r = runPathCheck(PATH, []);
    expect(r.rating).toBe("clear");
    expect(r.nearby).toHaveLength(0);
    expect(r.difficultCount).toBe(0);
  });

  it("rates difficult when a difficult patch is within buffer", () => {
    const patch = makePatch([-122.3345, 47.6085], "difficult");
    const r = runPathCheck(PATH, [patch]);
    expect(r.rating).toBe("difficult");
    expect(r.difficultCount).toBe(1);
    expect(r.nearby).toContain(patch);
  });

  it("rates caution when only caution patches are nearby", () => {
    const patch = makePatch([-122.3345, 47.6085], "caution");
    const r = runPathCheck(PATH, [patch]);
    expect(r.rating).toBe("caution");
    expect(r.cautionCount).toBe(1);
  });

  it("prefers difficult over caution when both present", () => {
    const patches = [
      makePatch([-122.3345, 47.6085], "caution"),
      makePatch([-122.3345, 47.6085], "difficult"),
    ];
    const r = runPathCheck(PATH, patches);
    expect(r.rating).toBe("difficult");
  });

  it("excludes patches beyond buffer distance", () => {
    const farPatch = makePatch([-122.400, 47.700], "difficult");
    const r = runPathCheck(PATH, [farPatch]);
    expect(r.nearby).toHaveLength(0);
    expect(r.rating).toBe("clear");
  });

  it("returns clear with fewer than 2 coords", () => {
    const r = runPathCheck([[-122.335, 47.608]], [makePatch([-122.335, 47.608], "difficult")]);
    expect(r.distanceMeters).toBe(0);
    expect(r.rating).toBe("clear");
  });

  it("reports correct distance", () => {
    const r = runPathCheck(PATH, []);
    expect(r.distanceMeters).toBeGreaterThan(0);
    expect(r.distanceLabel).toMatch(/m$/);
  });

  it("PATH_CHECK_BUFFER_M is 15", () => {
    expect(PATH_CHECK_BUFFER_M).toBe(15);
  });
});
