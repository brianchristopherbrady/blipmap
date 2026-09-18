import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrsProfileKey } from "../../config/routing";
import { fetchRoute } from "../../gis/routing";
import { normalizeProfile } from "../profile";

vi.mock("../../config/routing", async importOriginal => ({
  ...await importOriginal<typeof import("../../config/routing")>(), ORS_API_KEY: "test-public-key",
}));
afterEach(() => vi.unstubAllGlobals());

function response(profile: string) {
  return new Response(JSON.stringify({
    metadata: { query: { profile } },
    features: [{
      geometry: { type: "LineString", coordinates: [[-122.335, 47.608], [-122.334, 47.609]] },
      properties: { summary: { distance: 150, duration: 120 }, segments: [{ steps: [
        { instruction: "Turn left onto 1st Avenue", distance: 150, duration: 120 },
      ] }] },
    }],
  }));
}

describe("non-driving directions requests", () => {
  it("sends stair avoidance for walking independently of mobility aids", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response("foot-walking"));
    vi.stubGlobal("fetch", fetchMock);
    await fetchRoute([0, 0], [1, 1], "foot-walk", undefined, { ...normalizeProfile({}), avoidStairs: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).options).toEqual({ avoid_features: ["steps"] });
  });
  it("blocks unenforceable requirements before sending any coordinates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchRoute([0, 0], [1, 1], "foot-walk", undefined, { ...normalizeProfile({}), minimumWidthM: 1 })).rejects.toThrow("minimum path width");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([
    ["foot-walk", "foot-walking"], ["foot-hike", "foot-hiking"],
    ["wheelchair", "wheelchair"], ["cycling", "cycling-regular"],
  ] as const)("uses %s access rules for route geometry and instructions", async (profile, providerProfile) => {
    const fetchMock = vi.fn().mockResolvedValue(response(providerProfile));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = await fetchRoute([-122.335, 47.608], [-122.334, 47.609], profile, controller.signal);
    expect(fetchMock).toHaveBeenCalledWith(`https://api.openrouteservice.org/v2/directions/${providerProfile}/geojson`,
      expect.objectContaining({ method: "POST", signal: controller.signal }));
    expect(result.steps[0].instruction).toBe("Turn left onto 1st Avenue");
  });
  it.each(["driving-car", "driving-hgv", "constructor", "unknown"])("rejects %s before requesting any route", async profile => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchRoute([0, 0], [1, 1], profile as OrsProfileKey)).rejects.toThrow("Driving routes are not supported");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rejects an explicitly mismatched response profile", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("driving-car")));
    await expect(fetchRoute([0, 0], [1, 1], "foot-walk")).rejects.toThrow("different travel profile");
  });
  it("never falls back to driving when a non-driving route is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("No route", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchRoute([0, 0], [1, 1], "wheelchair")).rejects.toThrow("Routing failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/wheelchair/");
  });
});