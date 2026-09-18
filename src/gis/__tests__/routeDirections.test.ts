import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRouteStep } from "../routeDirections";
import { fetchRoute, type RouteStep } from "../routing";

vi.mock("../../config/routing", async importOriginal => ({
  ...await importOriginal<typeof import("../../config/routing")>(), ORS_API_KEY: "test-public-key",
}));
afterEach(() => vi.unstubAllGlobals());

const step: RouteStep = { instruction: "Turn right", distanceM: 402, durationS: 300, type: 1 };

describe("formatRouteStep", () => {
  it("adds a separate provider name to a generic maneuver with readable distance separation", () => {
    expect(formatRouteStep({ ...step, name: " Pine Street " })).toBe("Turn right (Pine Street) (402 m)");
  });

  it("does not duplicate a name already in the instruction", () => {
    expect(formatRouteStep({ ...step, instruction: "Turn right onto Pine Street", name: "pine street" }))
      .toBe("Turn right onto Pine Street (402 m)");
  });

  it.each([undefined, "-"])("preserves a name supplied in the instruction when the separate field is %s", name => {
    expect(formatRouteStep({ ...step, instruction: "Turn right onto Pine Street", name }))
      .toBe("Turn right onto Pine Street (402 m)");
  });

  it.each([undefined, "", "  ", "-", "---", "unknown", "Unnamed", "unnamed road"])("labels unavailable provider name %s honestly", name => {
    expect(formatRouteStep({ ...step, name })).toBe("Turn right (street/path name not provided) (402 m)");
  });

  it.each([null, 123, { name: "Pine Street" }])("treats malformed runtime name %j as unavailable", name => {
    const malformedStep = { ...step, name } as unknown as RouteStep;
    expect(formatRouteStep(malformedStep)).toBe("Turn right (street/path name not provided) (402 m)");
    expect(formatRouteStep({ ...malformedStep, instruction: "Turn right onto Pine Street" }))
      .toBe("Turn right onto Pine Street (402 m)");
  });

  it("does not attach a road name or missing-name warning to arrival", () => {
    expect(formatRouteStep({ ...step, instruction: "You have arrived at your destination", type: 10, name: "Pine Street", distanceM: 0 }))
      .toBe("You have arrived at your destination");
    expect(formatRouteStep({ ...step, instruction: "You have arrived", type: undefined, distanceM: 0 }))
      .toBe("You have arrived");
  });

  it("keeps short and zero-distance maneuvers without mutating them", () => {
    const short = Object.freeze({ ...step, name: "Pine Street", distanceM: 1 });
    expect(formatRouteStep(short)).toBe("Turn right (Pine Street) (1 m)");
    expect(formatRouteStep({ ...short, distanceM: 0 })).toBe("Turn right (Pine Street)");
  });

  it("returns provider text verbatim for the rendering layer to escape", () => {
    expect(formatRouteStep({ ...step, name: '<img src=x onerror="alert(1)"> & Pine' }))
      .toBe('Turn right (<img src=x onerror="alert(1)"> & Pine) (402 m)');
  });
});

it("preserves provider names, maneuver types, waypoint indices and every maneuver", async () => {
  const coordinates = [[-122.335, 47.608], [-122.334, 47.609]];
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
    features: [{
      geometry: { type: "LineString", coordinates },
      properties: { summary: { distance: 403, duration: 301 }, segments: [{ steps: [
        { instruction: "Turn right", name: "Pine Street", type: 1, way_points: [0, 1], distance: 402, duration: 300 },
        { instruction: "Turn left", name: "-", type: 0, way_points: [1, 1], distance: 1, duration: 1 },
        { instruction: "You have arrived", name: "-", type: 10, way_points: [1, 1], distance: 0, duration: 0 },
      ] }] },
    }],
  }))));
  const result = await fetchRoute([-122.335, 47.608], [-122.334, 47.609]);
  expect(result.coordinates).toEqual(coordinates);
  expect(result.steps).toEqual([
    { ...step, name: "Pine Street", wayPoints: [0, 1] },
    { instruction: "Turn left", name: "-", type: 0, wayPoints: [1, 1], distanceM: 1, durationS: 1 },
    { instruction: "You have arrived", name: "-", type: 10, wayPoints: [1, 1], distanceM: 0, durationS: 0 },
  ]);
});